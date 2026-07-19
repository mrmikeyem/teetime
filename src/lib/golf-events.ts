import "server-only";
import { prisma } from "@/lib/prisma";
import { isoDateInAppTz } from "@/lib/time";

/**
 * Events module (the "weekend hub"): a generic multi-day, multi-round,
 * multi-location competition grouping existing tee times. First instance:
 * Man Weekend 2026. NOTE: the REST API lives under /api/event (singular) —
 * /api/events is the pre-existing SSE stream.
 */

export type EventStatus = "UPCOMING" | "ACTIVE" | "COMPLETE";

/**
 * Status is derived from the dates, never stored — it can't go stale.
 * start/end are @db.Date columns (Prisma returns UTC-midnight Dates), so
 * compare calendar strings against "today" in the app timezone.
 */
export function eventStatus(
  ev: { startDate: Date; endDate: Date },
  now: Date = new Date()
): EventStatus {
  const today = isoDateInAppTz(now);
  const start = ev.startDate.toISOString().slice(0, 10);
  const end = ev.endDate.toISOString().slice(0, 10);
  if (today < start) return "UPCOMING";
  if (today > end) return "COMPLETE";
  return "ACTIVE";
}

/** The full include tree the hub page renders from. */
export function hubInclude() {
  return {
    creator: { select: { id: true, name: true } },
    teams: {
      orderBy: { seq: "asc" as const },
      include: { members: { include: { user: { select: { id: true, name: true } } } } },
    },
    participants: {
      orderBy: { createdAt: "asc" as const },
      include: { user: { select: { id: true, name: true } } },
    },
    rounds: {
      orderBy: { seq: "asc" as const },
      include: {
        teeTimes: {
          orderBy: { teeOffAt: "asc" as const },
          include: {
            members: {
              include: {
                user: { select: { id: true, name: true } },
                guest: { select: { id: true, name: true } },
              },
              orderBy: { createdAt: "asc" as const },
            },
          },
        },
        scores: true,
        players: true,
      },
    },
    games: {
      orderBy: { createdAt: "asc" as const },
      include: {
        winnerParticipant: { include: { user: { select: { name: true } } } },
        winnerTeam: { select: { id: true, name: true } },
        round: { select: { id: true, seq: true, name: true } },
      },
    },
  };
}

export async function getEventForHub(id: string) {
  return prisma.event.findUnique({ where: { id }, include: hubInclude() });
}

export type HubEvent = NonNullable<Awaited<ReturnType<typeof getEventForHub>>>;

/**
 * Resolve which team a participant plays for in a given round:
 * per-round override (rotating-team formats) beats the event-level default.
 */
export function roundTeamId(
  participant: { id: string; teamId: string | null },
  roundPlayers: { participantId: string; teamId: string | null }[]
): string | null {
  const row = roundPlayers.find((p) => p.participantId === participant.id);
  return row?.teamId ?? participant.teamId;
}

export type TeamStanding = {
  teamId: string;
  name: string;
  color: string | null;
  /** roundId → entered score (null until anything is entered) */
  byRound: Record<string, { front9: number | null; back9: number | null; total: number }>;
  cumulative: number;
  roundsScored: number;
};

export type PlayerStanding = {
  participantId: string;
  name: string;
  points: number;
};

export type Standings = {
  mode: "TEAM_CUMULATIVE" | "INDIVIDUAL_POINTS";
  teams: TeamStanding[];
  players: PlayerStanding[];
  /** e.g. "Team 2 leads by 3" — null until at least one score is in. */
  leaderLine: string | null;
};

export function computeStandings(ev: HubEvent): Standings {
  const teams: TeamStanding[] = ev.teams.map((t) => ({
    teamId: t.id,
    name: t.name,
    color: t.color,
    byRound: {},
    cumulative: 0,
    roundsScored: 0,
  }));
  const byTeamId = new Map(teams.map((t) => [t.teamId, t]));

  for (const round of ev.rounds) {
    for (const s of round.scores) {
      const team = byTeamId.get(s.teamId);
      if (!team) continue;
      const total = (s.front9 ?? 0) + (s.back9 ?? 0);
      if (s.front9 == null && s.back9 == null) continue;
      team.byRound[round.id] = { front9: s.front9, back9: s.back9, total };
      team.cumulative += total;
      team.roundsScored += 1;
    }
  }

  // Individual points: each member of a round's winning team (lowest entered
  // total) earns 1 point; ties split nothing — both teams' players get the
  // point. Game rows with explicit points add to the winner.
  const players: PlayerStanding[] = ev.participants.map((p) => ({
    participantId: p.id,
    name: p.user.name,
    points: 0,
  }));
  const playerById = new Map(players.map((p) => [p.participantId, p]));

  if (ev.standingsMode === "INDIVIDUAL_POINTS") {
    for (const round of ev.rounds) {
      const entered = round.scores.filter(
        (s) => s.front9 != null || s.back9 != null
      );
      if (entered.length === 0) continue;
      const best = Math.min(
        ...entered.map((s) => (s.front9 ?? 0) + (s.back9 ?? 0))
      );
      const winningTeamIds = new Set(
        entered
          .filter((s) => (s.front9 ?? 0) + (s.back9 ?? 0) === best)
          .map((s) => s.teamId)
      );
      for (const p of ev.participants) {
        const teamId = roundTeamId(p, round.players);
        if (teamId && winningTeamIds.has(teamId)) {
          const row = playerById.get(p.id);
          if (row) row.points += 1;
        }
      }
    }
  }
  for (const g of ev.games) {
    if (g.points && g.winnerParticipantId) {
      const row = playerById.get(g.winnerParticipantId);
      if (row) row.points += g.points;
    }
  }

  const scored = teams.filter((t) => t.roundsScored > 0);
  let leaderLine: string | null = null;
  if (ev.standingsMode === "TEAM_CUMULATIVE" && scored.length >= 2) {
    const sorted = [...scored].sort((a, b) => a.cumulative - b.cumulative);
    const gap = sorted[1].cumulative - sorted[0].cumulative;
    leaderLine =
      gap === 0
        ? `${sorted[0].name} and ${sorted[1].name} are tied`
        : `${sorted[0].name} leads by ${gap}`;
  } else if (ev.standingsMode === "INDIVIDUAL_POINTS") {
    const withPoints = [...players].sort((a, b) => b.points - a.points);
    if (withPoints[0]?.points > 0) {
      leaderLine = `${withPoints[0].name} leads with ${withPoints[0].points} pt${
        withPoints[0].points === 1 ? "" : "s"
      }`;
    }
  }

  players.sort((a, b) => b.points - a.points);
  return { mode: ev.standingsMode, teams, players, leaderLine };
}

/** Validation shared by the event create + edit routes. */
export function parseEventFields(body: Record<string, unknown>):
  | {
      name: string;
      location: string | null;
      rules: string | null;
      startDate: Date;
      endDate: Date;
      standingsMode: "TEAM_CUMULATIVE" | "INDIVIDUAL_POINTS";
    }
  | { error: string } {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return { error: "Event name is required" };

  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  const start = typeof body.startDate === "string" ? body.startDate : "";
  const end = typeof body.endDate === "string" ? body.endDate : "";
  if (!dateRe.test(start) || !dateRe.test(end)) {
    return { error: "Start and end dates are required" };
  }
  if (end < start) return { error: "End date is before the start date" };

  const standingsMode =
    body.standingsMode === "INDIVIDUAL_POINTS"
      ? ("INDIVIDUAL_POINTS" as const)
      : ("TEAM_CUMULATIVE" as const);

  return {
    name,
    location:
      typeof body.location === "string" && body.location.trim()
        ? body.location.trim()
        : null,
    rules:
      typeof body.rules === "string" && body.rules.trim()
        ? body.rules.trim()
        : null,
    // @db.Date columns — store as UTC midnight of the calendar day.
    startDate: new Date(`${start}T00:00:00Z`),
    endDate: new Date(`${end}T00:00:00Z`),
    standingsMode,
  };
}

import "server-only";
import { createHash } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { getRoundForecast } from "./weather-summary";
import {
  computeStandings,
  eventStatus,
  roundTeamId,
  type HubEvent,
} from "./golf-events";
import { APP_TZ } from "./time";

/**
 * AI reports for the event hub, same discipline as weather-summary-cache:
 * paid Haiku calls behind an in-process cache (single long-lived prod
 * process; globalThis guard for dev HMR).
 *
 * - Outlook: multi-day weather/packing preview. Sliding TTL like the round
 *   blurbs — tight when the event is close, loose when it's far out.
 * - Recap: sports-writer summary of the scores so far. Cached on a content
 *   hash of scores/games/mulligans — regenerates only when the data changes.
 */

type Entry = { text: string; identity: string; generatedAtMs: number };

const globalForReports = globalThis as unknown as {
  eventReportCache?: Map<string, Entry>;
};
const store = (globalForReports.eventReportCache ??= new Map());

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const NULL_RETRY_MS = 10 * MIN;

function firstTeeOff(ev: HubEvent): Date | null {
  const all = ev.rounds.flatMap((r) => r.teeTimes.map((t) => t.teeOffAt));
  if (all.length === 0) return null;
  return new Date(Math.min(...all.map((d) => d.getTime())));
}

function outlookTtlMs(ev: HubEvent, nowMs: number): number {
  const first = firstTeeOff(ev);
  if (!first) return 24 * HOUR;
  const hoursOut = (first.getTime() - nowMs) / HOUR;
  if (hoursOut <= 24) return 30 * MIN;
  if (hoursOut <= 72) return HOUR;
  if (hoursOut <= 168) return 6 * HOUR;
  return 24 * HOUR;
}

function ctDateTime(d: Date): string {
  return d.toLocaleString("en-US", {
    timeZone: APP_TZ,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function compass(deg: number): string {
  const dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}

async function askHaiku(system: string, user: string): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 500,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: user }],
    });
    const block = response.content.find(
      (b): b is Anthropic.TextBlock => b.type === "text"
    );
    const out = block?.text?.trim();
    return out && out.toLowerCase() !== "null" ? out : null;
  } catch {
    return null;
  }
}

const OUTLOOK_SYSTEM = `You write a short "weekend outlook" for a private golf trip: several rounds over one or more days, possibly at different courses. The reader is a casual men's golf group.

Input: the event name/dates and, per round, the course, tee-off time, and a one-line forecast at tee-off (may be missing when the round is beyond forecast range).

Output: ONE paragraph (3-6 sentences, ~110 words max) that reads across the whole trip — how conditions differ round to round (a 3pm bake vs an 8:30am dew round), what to pack for the spread of conditions, and any round that stands out (wind, rain risk, heat). Be specific with numbers and times. If some rounds have no forecast yet, say the picture firms up closer in — don't invent.

No greetings, no sign-offs, no emojis, no bullet lists. Plain prose, casual tone.`;

const RECAP_SYSTEM = `You write a short, punchy recap of a golf trip's competition so far, in the voice of a local sports writer who knows the group. Dry wit welcome; never mean.

Input: the event name and format, team standings (per-round and cumulative strokes — LOWER is better), mulligans burned and drives used per player per round, and side games with winners.

Output: ONE paragraph (3-6 sentences, ~110 words max). Lead with the state of the race (who leads, by how much, what swung it). Work in one or two color details — a burned mulligan, a side-game winner — when the data has them. Use names. Numbers over adjectives. If only one round is in, frame it as the opener, not the whole story.

No greetings, no sign-offs, no emojis, no bullet lists. Plain prose.`;

export type EventReport = { text: string; ageMin: number };

function withAge(e: Entry, nowMs: number): EventReport {
  return {
    text: e.text,
    ageMin: Math.max(0, Math.round((nowMs - e.generatedAtMs) / MIN)),
  };
}

/** Multi-round weather outlook for the hub. Null when nothing to say yet. */
export async function getCachedEventOutlook(
  ev: HubEvent
): Promise<EventReport | null> {
  if (ev.rounds.length === 0) return null;
  if (eventStatus(ev) === "COMPLETE") return null;

  const now = Date.now();
  const key = `outlook:${ev.id}`;
  const identity = ev.rounds
    .map((r) => {
      const t = r.teeTimes[0];
      return t ? `${t.lat},${t.lon},${t.teeOffAt.toISOString()}` : "none";
    })
    .join("|");

  const hit = store.get(key);
  if (hit && hit.identity === identity) {
    if (now - hit.generatedAtMs < outlookTtlMs(ev, now)) return withAge(hit, now);
  }

  const lines: string[] = [
    `Event: ${ev.name}${ev.location ? ` — ${ev.location}` : ""}`,
    "",
  ];
  let anyForecast = false;
  for (const r of ev.rounds) {
    const t = r.teeTimes[0];
    const label = r.name ?? `Round ${r.seq}`;
    if (!t) {
      lines.push(`${label}: no tee times yet`);
      continue;
    }
    let forecastLine = "no forecast yet (beyond range)";
    if (t.lat != null && t.lon != null) {
      const fc = await getRoundForecast(
        { lat: t.lat, lon: t.lon },
        t.teeOffAt
      ).catch(() => null);
      if (fc) {
        anyForecast = true;
        const p = fc.teeOff;
        forecastLine = `${p.tempF}°F (feels ${p.feelsLikeF}°F), wind ${p.windMph}mph ${compass(p.windDirDeg)} gusting ${p.gustsMph}, ${p.precipChance}% precip`;
      }
    }
    lines.push(`${label} — ${t.course}, ${ctDateTime(t.teeOffAt)} CT: ${forecastLine}`);
  }
  if (!anyForecast) return null; // everything beyond forecast range — wait

  const text = await askHaiku(OUTLOOK_SYSTEM, lines.join("\n"));
  if (!text) {
    // Don't hammer Haiku on failure; brief negative-cache via short TTL.
    store.set(key, { text: "", identity, generatedAtMs: now - outlookTtlMs(ev, now) + NULL_RETRY_MS });
    return null;
  }
  const entry: Entry = { text, identity, generatedAtMs: now };
  store.set(key, entry);
  return withAge(entry, now);
}

/** Sports-writer recap once scores exist. Regenerates only when data changes. */
export async function getCachedEventRecap(
  ev: HubEvent
): Promise<EventReport | null> {
  const standings = computeStandings(ev);
  const scoredRounds = ev.rounds.filter((r) =>
    r.scores.some((s) => s.front9 != null || s.back9 != null)
  );
  if (scoredRounds.length === 0) return null;

  const now = Date.now();
  const key = `recap:${ev.id}`;

  const participantName = new Map(ev.participants.map((p) => [p.id, p.user.name]));
  const teamName = new Map(ev.teams.map((t) => [t.id, t.name]));

  const payload = {
    rounds: scoredRounds.map((r) => ({
      label: r.name ?? `Round ${r.seq}`,
      course: r.teeTimes[0]?.course ?? null,
      format: r.format,
      scores: r.scores.map((s) => ({
        team: teamName.get(s.teamId),
        front9: s.front9,
        back9: s.back9,
      })),
      players: r.players
        .filter((p) => p.mulliFront || p.mulliBack || p.driveUsed)
        .map((p) => {
          const participant = ev.participants.find((x) => x.id === p.participantId);
          return {
            name: participant ? participantName.get(participant.id) : "?",
            team: participant
              ? teamName.get(roundTeamId(participant, r.players) ?? "") ?? null
              : null,
            mulliFront: p.mulliFront,
            mulliBack: p.mulliBack,
            driveUsed: p.driveUsed,
          };
        }),
    })),
    cumulative: standings.teams.map((t) => ({
      team: t.name,
      total: t.cumulative,
      roundsScored: t.roundsScored,
    })),
    playerPoints:
      standings.mode === "INDIVIDUAL_POINTS" ? standings.players : undefined,
    games: ev.games
      .filter((g) => g.winnerParticipantId || g.winnerTeamId)
      .map((g) => ({
        name: g.name,
        hole: g.hole,
        winner:
          g.winnerParticipant?.user.name ?? g.winnerTeam?.name ?? null,
        payout: g.payoutNote,
      })),
  };
  const identity = createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");

  const hit = store.get(key);
  if (hit && hit.identity === identity && hit.text) return withAge(hit, now);
  if (hit && hit.identity === identity && !hit.text) {
    if (now - hit.generatedAtMs < NULL_RETRY_MS) return null;
  }

  const user = `Event: ${ev.name} (${ev.standingsMode === "TEAM_CUMULATIVE" ? "cumulative team strokes, lowest wins" : "individual points, most wins"})\n\n${JSON.stringify(payload, null, 2)}`;
  const text = await askHaiku(RECAP_SYSTEM, user);
  const entry: Entry = { text: text ?? "", identity, generatedAtMs: now };
  store.set(key, entry);
  return text ? withAge(entry, now) : null;
}

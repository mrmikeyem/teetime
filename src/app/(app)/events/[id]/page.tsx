import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin";
import {
  computeStandings,
  eventStatus,
  getEventForHub,
  roundTeamId,
} from "@/lib/golf-events";
import { getCachedEventOutlook, getCachedEventRecap } from "@/lib/event-report";
import { getCachedRoundSummary } from "@/lib/weather-summary-cache";
import { getWeatherForTeeTime, type WeatherSummary } from "@/lib/weather";
import { APP_TZ } from "@/lib/time";
import { AutoRefresh } from "../../tee-times/auto-refresh";
import { WeatherChip } from "../../tee-times/weather-chip";
import { ScoreEntry } from "./score-entry";
import { MulliganBoard, type BoardPlayer } from "./mulligan-board";
import { GamesBoard, type GameRow } from "./games-board";
import { TeamsManager } from "./teams-manager";
import { RoundBuilder } from "./round-builder";
import { RoundTools } from "./round-tools";
import { AnnounceButton } from "./announce-button";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  ACTIVE:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  UPCOMING: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
  COMPLETE: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

const FORMAT_LABEL: Record<string, string> = {
  STROKE: "Stroke",
  SCRAMBLE: "Scramble",
  BEST_BALL: "Best ball",
  MATCH_PLAY: "Match play",
  OTHER: "Other",
};

const card =
  "rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800";
const sectionTitle =
  "text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400";

export default async function EventHubPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");
  const { id } = await params;

  const ev = await getEventForHub(id);
  if (!ev) notFound();

  const admin = await isAdmin();
  const status = eventStatus(ev);
  const standings = computeStandings(ev);

  const [outlook, recap, addableUsers] = await Promise.all([
    getCachedEventOutlook(ev),
    getCachedEventRecap(ev),
    admin
      ? prisma.user.findMany({
          where: { id: { notIn: ev.participants.map((p) => p.userId) } },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ]);

  // Per-round extras: weather chips per tee time + the round blurb.
  const roundExtras = await Promise.all(
    ev.rounds.map(async (round) => {
      const weather = new Map<string, WeatherSummary | null>();
      await Promise.all(
        round.teeTimes.map(async (t) => {
          if (t.lat == null || t.lon == null) return;
          weather.set(
            t.id,
            await getWeatherForTeeTime(
              { lat: t.lat, lon: t.lon },
              t.teeOffAt
            ).catch(() => null)
          );
        })
      );
      const first = round.teeTimes[0];
      const blurb =
        first && first.lat != null && first.lon != null
          ? await getCachedRoundSummary({
              id: first.id,
              lat: first.lat,
              lon: first.lon,
              teeOffAt: first.teeOffAt,
              course: first.course,
            })
          : null;
      return { weather, blurb: blurb?.summary ?? null };
    })
  );

  const teamNameById = new Map(ev.teams.map((t) => [t.id, t.name]));
  const showRoundColumns = ev.rounds.length > 0;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 space-y-6">
      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-lg font-bold leading-tight sm:text-2xl">
              ⛳ {ev.name}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {formatRange(ev.startDate, ev.endDate)}
              {ev.location ? ` · ${ev.location}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[status]}`}
            >
              {status.toLowerCase()}
            </span>
            <Link
              href="/events"
              className="rounded-lg bg-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            >
              ←
            </Link>
          </div>
        </div>
      </header>

      {/* ── Standings ──────────────────────────────────────────── */}
      {ev.teams.length > 0 && (
        <section className={card}>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className={sectionTitle}>Standings</h2>
            {standings.leaderLine && (
              <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                {standings.leaderLine}
              </span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 dark:text-gray-400">
                  <th className="pb-1 pr-2 font-semibold">Team</th>
                  {showRoundColumns &&
                    ev.rounds.map((r) => (
                      <th key={r.id} className="pb-1 px-2 text-center font-semibold">
                        R{r.seq}
                      </th>
                    ))}
                  <th className="pb-1 pl-2 text-right font-semibold">Total</th>
                </tr>
              </thead>
              <tbody>
                {standings.teams.map((t) => (
                  <tr
                    key={t.teamId}
                    className="border-t border-gray-100 dark:border-gray-700"
                  >
                    <td className="py-1.5 pr-2 font-semibold text-gray-900 dark:text-gray-100">
                      {t.name}
                    </td>
                    {showRoundColumns &&
                      ev.rounds.map((r) => (
                        <td
                          key={r.id}
                          className="py-1.5 px-2 text-center tabular-nums text-gray-700 dark:text-gray-300"
                        >
                          {t.byRound[r.id]?.total ?? "—"}
                        </td>
                      ))}
                    <td className="py-1.5 pl-2 text-right font-bold tabular-nums text-gray-900 dark:text-gray-100">
                      {t.roundsScored > 0 ? t.cumulative : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {standings.mode === "INDIVIDUAL_POINTS" &&
            standings.players.some((p) => p.points > 0) && (
              <div className="mt-3 border-t border-gray-100 pt-3 dark:border-gray-700">
                <p className={`${sectionTitle} mb-1`}>Player points</p>
                <ul className="space-y-0.5 text-sm">
                  {standings.players.map((p) => (
                    <li key={p.participantId} className="flex justify-between">
                      <span className="text-gray-800 dark:text-gray-200">
                        {p.name}
                      </span>
                      <span className="font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                        {p.points}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
        </section>
      )}

      {/* ── AI reports ─────────────────────────────────────────── */}
      {recap && (
        <section className={card}>
          <h2 className={`${sectionTitle} mb-2`}>📰 The story so far</h2>
          <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            {recap.text}
          </p>
        </section>
      )}
      {outlook && status !== "COMPLETE" && (
        <section className={card}>
          <h2 className={`${sectionTitle} mb-2`}>🔭 Weekend outlook</h2>
          <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            {outlook.text}
          </p>
        </section>
      )}

      {/* ── Rounds ─────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className={sectionTitle}>Rounds</h2>
        {ev.rounds.length === 0 && (
          <p className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
            No rounds yet{admin ? " — build the schedule below." : "."}
          </p>
        )}
        {ev.rounds.map((round, i) => {
          const extras = roundExtras[i];
          const first = round.teeTimes[0];
          const boardPlayers: BoardPlayer[] = ev.participants.map((p) => {
            const row = round.players.find((rp) => rp.participantId === p.id);
            const resolved = roundTeamId(p, round.players);
            return {
              participantId: p.id,
              name: p.user.name,
              teamName: resolved ? teamNameById.get(resolved) ?? null : null,
              overrideTeamId: row?.teamId ?? null,
              mulliFront: row?.mulliFront ?? false,
              mulliBack: row?.mulliBack ?? false,
              driveUsed: row?.driveUsed ?? false,
            };
          });
          return (
            <div key={round.id} className={`${card} space-y-4`}>
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                  {round.name ?? `Round ${round.seq}`}
                  {round.format && (
                    <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                      {FORMAT_LABEL[round.format]}
                    </span>
                  )}
                </h3>
                {first && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {formatDay(first.teeOffAt)}
                  </span>
                )}
              </div>

              {/* Tee times */}
              {round.teeTimes.length > 0 && (
                <ul className="space-y-2">
                  {round.teeTimes.map((t) => {
                    const w = extras.weather.get(t.id);
                    return (
                      <li key={t.id}>
                        <Link
                          href={`/tee-times/${t.id}`}
                          className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700"
                        >
                          <span className="font-semibold text-gray-900 dark:text-gray-100">
                            {formatTime(t.teeOffAt)}
                          </span>
                          <span className="text-gray-600 dark:text-gray-300">
                            {t.course}
                          </span>
                          {w && <WeatherChip weather={w} />}
                          <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">
                            {t.members.length === 0
                              ? "no one yet"
                              : t.members
                                  .map(
                                    (m) =>
                                      m.user?.name ?? m.guest?.name ?? "?"
                                  )
                                  .join(", ")}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}

              {extras.blurb && (
                <p className="rounded-lg bg-sky-50 p-3 text-xs leading-relaxed text-sky-900 dark:bg-sky-900/20 dark:text-sky-200">
                  {extras.blurb}
                </p>
              )}

              {/* Scores */}
              {ev.teams.length > 0 && (
                <div>
                  <p className={`${sectionTitle} mb-2`}>Score — front / back</p>
                  <ScoreEntry
                    eventId={ev.id}
                    roundId={round.id}
                    teams={ev.teams.map((t) => {
                      const s = round.scores.find((x) => x.teamId === t.id);
                      return {
                        teamId: t.id,
                        teamName: t.name,
                        front9: s?.front9 ?? null,
                        back9: s?.back9 ?? null,
                      };
                    })}
                  />
                </div>
              )}

              {/* Mulligans / drives */}
              {ev.participants.length > 0 && (
                <div>
                  <p className={`${sectionTitle} mb-2`}>
                    Mulligans & drives{" "}
                    <span className="font-normal normal-case">
                      (M1 front · M2 back · D drive used)
                    </span>
                  </p>
                  <MulliganBoard
                    eventId={ev.id}
                    roundId={round.id}
                    players={boardPlayers}
                    teams={ev.teams.map((t) => ({ id: t.id, name: t.name }))}
                    isAdmin={admin}
                  />
                </div>
              )}

              {admin && (
                <RoundTools
                  eventId={ev.id}
                  roundId={round.id}
                  name={round.name}
                  format={round.format}
                />
              )}
            </div>
          );
        })}
        {admin && (
          <div className={card}>
            <p className={`${sectionTitle} mb-2`}>Add a round</p>
            <RoundBuilder eventId={ev.id} />
          </div>
        )}
      </section>

      {/* ── Teams ──────────────────────────────────────────────── */}
      <section className={card}>
        <h2 className={`${sectionTitle} mb-3`}>Teams</h2>
        {ev.teams.length === 0 && ev.participants.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No teams or players yet.
            {admin && " Add players below, or draw teams in the generator."}
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {ev.teams.map((t) => (
              <div
                key={t.id}
                className="rounded-lg border border-gray-200 p-4 dark:border-gray-600"
              >
                <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
                  {t.name}
                </p>
                <ul className="mt-2 space-y-1">
                  {ev.participants
                    .filter((p) => p.teamId === t.id)
                    .map((p) => (
                      <li
                        key={p.id}
                        className="text-sm text-gray-700 dark:text-gray-200"
                      >
                        {p.user.name}
                      </li>
                    ))}
                </ul>
              </div>
            ))}
            {ev.participants.some((p) => !p.teamId) && (
              <div className="rounded-lg border border-dashed border-gray-300 p-4 dark:border-gray-600">
                <p className="text-sm font-bold text-gray-500 dark:text-gray-400">
                  Unassigned
                </p>
                <ul className="mt-2 space-y-1">
                  {ev.participants
                    .filter((p) => !p.teamId)
                    .map((p) => (
                      <li
                        key={p.id}
                        className="text-sm text-gray-700 dark:text-gray-200"
                      >
                        {p.user.name}
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </div>
        )}
        {admin && (
          <div className="mt-4 border-t border-gray-100 pt-4 dark:border-gray-700">
            <div className="mb-2 flex items-baseline justify-between">
              <p className={sectionTitle}>Manage</p>
              <Link
                href={`/teams?event=${ev.id}`}
                className="text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
              >
                🎲 Draw teams in the generator →
              </Link>
            </div>
            <TeamsManager
              eventId={ev.id}
              teams={ev.teams.map((t) => ({ id: t.id, name: t.name }))}
              participants={ev.participants.map((p) => ({
                id: p.id,
                name: p.user.name,
                teamId: p.teamId,
              }))}
              addableUsers={addableUsers}
            />
          </div>
        )}
      </section>

      {/* ── Games ──────────────────────────────────────────────── */}
      <section className={card}>
        <h2 className={`${sectionTitle} mb-3`}>Games & props</h2>
        <GamesBoard
          eventId={ev.id}
          games={ev.games.map(
            (g): GameRow => ({
              id: g.id,
              name: g.name,
              type: g.type,
              hole: g.hole,
              roundId: g.roundId,
              roundLabel: g.round
                ? g.round.name ?? `Round ${g.round.seq}`
                : null,
              payoutNote: g.payoutNote,
              winnerValue: g.winnerParticipantId
                ? `p:${g.winnerParticipantId}`
                : g.winnerTeamId
                ? `t:${g.winnerTeamId}`
                : "",
              winnerName:
                g.winnerParticipant?.user.name ?? g.winnerTeam?.name ?? null,
            })
          )}
          participants={ev.participants.map((p) => ({
            id: p.id,
            name: p.user.name,
          }))}
          teams={ev.teams.map((t) => ({ id: t.id, name: t.name }))}
          rounds={ev.rounds.map((r) => ({
            id: r.id,
            label: r.name ?? `Round ${r.seq}`,
          }))}
          isAdmin={admin}
        />
      </section>

      {/* ── Rules ──────────────────────────────────────────────── */}
      {ev.rules && (
        <section className={card}>
          <h2 className={`${sectionTitle} mb-2`}>📜 Rules</h2>
          <p className="whitespace-pre-line text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            {ev.rules}
          </p>
        </section>
      )}

      {/* ── Admin tools ────────────────────────────────────────── */}
      {admin && (
        <section className={`${card} space-y-3`}>
          <h2 className={sectionTitle}>Admin</h2>
          <AnnounceButton eventId={ev.id} />
          <Link
            href={`/events/${ev.id}/edit`}
            className="inline-block rounded-lg bg-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
          >
            ✏️ Edit event details
          </Link>
        </section>
      )}

      <AutoRefresh />
    </main>
  );
}

function formatRange(start: Date, end: Date): string {
  const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) =>
    d.toLocaleDateString("en-US", { timeZone: "UTC", ...opts });
  if (start.getTime() === end.getTime()) {
    return fmt(start, { month: "short", day: "numeric", year: "numeric" });
  }
  const sameMonth =
    start.getUTCFullYear() === end.getUTCFullYear() &&
    start.getUTCMonth() === end.getUTCMonth();
  if (sameMonth) {
    return `${fmt(start, { month: "short", day: "numeric" })}–${fmt(end, {
      day: "numeric",
    })}, ${end.getUTCFullYear()}`;
  }
  return `${fmt(start, { month: "short", day: "numeric" })} – ${fmt(end, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
}

function formatDay(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: APP_TZ,
  });
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: APP_TZ,
  });
}

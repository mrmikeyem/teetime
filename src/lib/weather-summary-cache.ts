import "server-only";
import { getRoundSummary, type RoundForecast } from "./weather-summary";

// Sliding-TTL cache for the Claude "what to expect" blurb (Brett's design,
// docs/BRETT-TODO.md): far-out forecasts barely move hour to hour, so the
// paid Haiku call is cached long; day-of it tightens to the same 30-min
// window as the underlying Open-Meteo revalidation. Works because prod is
// ONE long-lived systemd process — a module-level Map survives requests
// (globalThis guard is for dev HMR, same as lib/prisma.ts). A restart or
// deploy clears it; that's fine, it repopulates on first view.

export type CachedSummary = {
  forecast: RoundForecast;
  summary: string | null;
  generatedAtMs: number;
  /** Whole minutes since generation, computed at read time (render-safe). */
  ageMin: number;
};

type Entry = Omit<CachedSummary, "ageMin"> & { identity: string };

const withAge = (entry: Entry, nowMs: number): CachedSummary => ({
  forecast: entry.forecast,
  summary: entry.summary,
  generatedAtMs: entry.generatedAtMs,
  ageMin: Math.max(0, Math.round((nowMs - entry.generatedAtMs) / MIN)),
});

const globalForCache = globalThis as unknown as {
  weatherSummaryCache?: Map<string, Entry>;
};
const store = (globalForCache.weatherSummaryCache ??= new Map());

const MIN = 60 * 1000;
const HOUR = 60 * MIN;

function ttlMs(teeOffAt: Date, nowMs: number): number {
  const hoursOut = (teeOffAt.getTime() - nowMs) / HOUR;
  if (hoursOut <= 0) return 24 * HOUR; // in progress / past — settled
  if (hoursOut <= 24) return 30 * MIN; // matches Open-Meteo revalidate
  if (hoursOut <= 72) return 1 * HOUR;
  if (hoursOut <= 168) return 6 * HOUR;
  return 24 * HOUR;
}

// A failed/empty summary shouldn't hide the blurb for a whole TTL window
// (transient Anthropic error days out = blank for 24h). Retry sooner.
const NULL_SUMMARY_TTL = 10 * MIN;

export type SummaryTarget = {
  id: string;
  lat: number;
  lon: number;
  teeOffAt: Date;
  course: string;
};

// Tee-off time, coords, and course participate in the key, so editing any
// of them invalidates naturally (Brett's "forecastSnapshotHash" intent).
const identityOf = (t: SummaryTarget) =>
  `${t.lat},${t.lon}|${t.teeOffAt.toISOString()}|${t.course}`;

function prune(nowMs: number) {
  if (store.size <= 200) return;
  for (const [key, entry] of store) {
    if (nowMs - entry.generatedAtMs > 48 * HOUR) store.delete(key);
  }
}

export async function getCachedRoundSummary(
  target: SummaryTarget
): Promise<CachedSummary | null> {
  const now = Date.now();
  const identity = identityOf(target);
  const hit = store.get(target.id);
  if (hit && hit.identity === identity) {
    const ttl =
      hit.summary === null
        ? NULL_SUMMARY_TTL
        : ttlMs(target.teeOffAt, now);
    if (now - hit.generatedAtMs < ttl) return withAge(hit, now);
  }
  return regenerate(target, { fresh: false });
}

/** Force a fresh Open-Meteo fetch + Claude call (the Refresh button). */
export async function refreshRoundSummary(
  target: SummaryTarget
): Promise<CachedSummary | null> {
  return regenerate(target, { fresh: true });
}

async function regenerate(
  target: SummaryTarget,
  opts: { fresh: boolean }
): Promise<CachedSummary | null> {
  const result = await getRoundSummary(
    { lat: target.lat, lon: target.lon },
    target.teeOffAt,
    { courseName: target.course, fresh: opts.fresh }
  );
  if (!result) return null; // out of forecast range — nothing to cache

  const entry: Entry = {
    identity: identityOf(target),
    forecast: result.forecast,
    summary: result.summary,
    generatedAtMs: Date.now(),
  };
  store.set(target.id, entry);
  prune(entry.generatedAtMs);
  return withAge(entry, entry.generatedAtMs);
}

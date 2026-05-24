import { getRoundSummary } from "@/lib/weather-summary";
import type { Coords } from "@/lib/weather";

export async function WhatToExpect({
  coords,
  teeOffAt,
}: {
  coords: Coords;
  teeOffAt: Date;
}) {
  const result = await getRoundSummary(coords, teeOffAt).catch(() => null);
  if (!result?.summary) return null;

  return (
    <div className="mt-2 rounded-lg bg-sky-50 dark:bg-sky-900/20 p-3 text-sm text-sky-900 dark:text-sky-200">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
        What to expect
      </p>
      <p className="leading-relaxed">{result.summary}</p>
    </div>
  );
}

export function WhatToExpectSpinner() {
  return (
    <div className="mt-2 rounded-lg bg-sky-50 dark:bg-sky-900/20 p-3 text-sm text-sky-900 dark:text-sky-200">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
        What to expect
      </p>
      <div className="flex items-center gap-3 text-sky-700/80 dark:text-sky-300/80">
        <span aria-hidden className="golfball-roll" />
        <span className="text-xs">Sizing up the round…</span>
      </div>
    </div>
  );
}

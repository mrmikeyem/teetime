import { getCachedRoundSummary } from "@/lib/weather-summary-cache";
import { RefreshForecast } from "./refresh-forecast";

export async function WhatToExpect({
  teeTimeId,
  lat,
  lon,
  teeOffAt,
  course,
}: {
  teeTimeId: string;
  lat: number;
  lon: number;
  teeOffAt: Date;
  course: string;
}) {
  const result = await getCachedRoundSummary({
    id: teeTimeId,
    lat,
    lon,
    teeOffAt,
    course,
  }).catch(() => null);
  if (!result?.summary) return null;

  return (
    <div className="mt-2 rounded-lg bg-sky-50 dark:bg-sky-900/20 p-3 text-sm text-sky-900 dark:text-sky-200">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
        What to expect
      </p>
      <p className="leading-relaxed">{result.summary}</p>
      <RefreshForecast teeTimeId={teeTimeId} ageMin={result.ageMin} />
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

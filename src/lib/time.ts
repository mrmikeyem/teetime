/**
 * Time utilities pinned to America/Chicago — the app's canonical timezone.
 *
 * Tee times in this app are scheduled and displayed in Central Time regardless
 * of where the viewer is. Server rendering runs in UTC on the droplet, so
 * relying on the default locale would cause UTC strings to leak into the UI.
 */

export const APP_TZ = "America/Chicago";

/**
 * Returns the UTC instant equal to midnight America/Chicago of "today".
 * Use this for the list-page filter: tee times with teeOffAt >= this instant
 * are "today or later" in CT, regardless of where the server is running.
 */
/**
 * Convert a wall-clock date+time in America/Chicago to the UTC instant.
 * `date` is "YYYY-MM-DD", `time` is "HH:MM" (24h). Two-pass offset lookup
 * handles DST transitions the same way startOfTodayInAppTz does.
 */
export function appTzWallTimeToUtc(date: string, time: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const wallAsUtc = Date.UTC(y, m - 1, d, hh, mm, 0);
  let utc = wallAsUtc + tzOffsetMs(new Date(wallAsUtc));
  // Second pass: the offset at the guessed instant can differ across a DST
  // boundary from the offset at the first guess.
  utc = wallAsUtc + tzOffsetMs(new Date(utc));
  return new Date(utc);
}

/** Milliseconds to ADD to a CT wall-clock-as-UTC value to get real UTC. */
function tzOffsetMs(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? "0");
  const wallAsUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") === 24 ? 0 : get("hour"),
    get("minute"),
    get("second")
  );
  return at.getTime() - wallAsUtc;
}

/** "YYYY-MM-DD" for a Date interpreted in the app timezone. */
export function isoDateInAppTz(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  return parts; // en-CA formats as YYYY-MM-DD
}

export function startOfTodayInAppTz(now: Date = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
  const ctY = Number(get("year"));
  const ctM = Number(get("month"));
  const ctD = Number(get("day"));
  const ctH = Number(get("hour"));
  const ctMin = Number(get("minute"));
  const ctS = Number(get("second"));
  // Offset between CT wall clock and UTC at this moment (handles DST automatically).
  const ctAsIfUtc = Date.UTC(ctY, ctM - 1, ctD, ctH, ctMin, ctS);
  const offsetMs = now.getTime() - ctAsIfUtc;
  return new Date(Date.UTC(ctY, ctM - 1, ctD, 0, 0, 0) + offsetMs);
}

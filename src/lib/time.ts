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

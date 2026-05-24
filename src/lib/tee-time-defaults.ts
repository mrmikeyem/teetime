export const GROUP_WEEKNIGHT_DEFAULT = "17:09";
export const GROUP_WEEKEND_DEFAULT = "10:00";

export function resolveTeeOffDefault(
  dateIso: string,
  userWeeknight: string | null,
  userWeekend: string | null
): string {
  if (!dateIso) return userWeeknight ?? GROUP_WEEKNIGHT_DEFAULT;
  // dateIso is YYYY-MM-DD from <input type="date">. Parse as local date.
  const [y, m, d] = dateIso.split("-").map(Number);
  if (!y || !m || !d) return userWeeknight ?? GROUP_WEEKNIGHT_DEFAULT;
  const dow = new Date(y, m - 1, d).getDay(); // Sun=0..Sat=6
  const isWeekend = dow === 0 || dow === 6;
  if (isWeekend) return userWeekend ?? GROUP_WEEKEND_DEFAULT;
  return userWeeknight ?? GROUP_WEEKNIGHT_DEFAULT;
}

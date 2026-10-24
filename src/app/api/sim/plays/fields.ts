import { appTzWallTimeToUtc } from "@/lib/time";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

/**
 * Shared parsing for creating/editing a play: CT wall-clock date (+ optional
 * time — no time means a date-only entry, stored at noon CT), comment, and
 * the played/suggested player sets.
 */
export function parsePlayFields(body: Record<string, unknown>):
  | { error: string }
  | {
      playedAt: Date;
      dateOnly: boolean;
      comment: string | null;
      playerRows: { playerId: string; played: boolean; suggested: boolean }[];
    } {
  const date = typeof body.date === "string" ? body.date : "";
  const time = typeof body.time === "string" ? body.time : "";
  if (!DATE_RE.test(date)) return { error: "A valid date is required" };
  if (time && !TIME_RE.test(time)) return { error: "Invalid time" };

  const ids = (v: unknown) =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  const played = new Set(ids(body.playerIds));
  const suggested = new Set(ids(body.suggesterIds));
  const all = Array.from(new Set([...played, ...suggested]));

  const comment = typeof body.comment === "string" ? body.comment.trim() : "";
  return {
    playedAt: appTzWallTimeToUtc(date, time || "12:00"),
    dateOnly: !time,
    comment: comment || null,
    playerRows: all.map((playerId) => ({
      playerId,
      played: played.has(playerId),
      suggested: suggested.has(playerId),
    })),
  };
}

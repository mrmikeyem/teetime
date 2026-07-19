import Link from "next/link";
import { APP_TZ } from "@/lib/time";

export type EventCardRound = {
  id: string;
  label: string;
  course: string | null;
  /** ISO strings of the round's tee-offs, ascending. */
  teeOffs: string[];
};

export type EventCardData = {
  id: string;
  name: string;
  startDate: string; // ISO
  endDate: string;
  location: string | null;
  status: "UPCOMING" | "ACTIVE" | "COMPLETE";
  leaderLine: string | null;
  rounds: EventCardRound[];
  /** Chronological slot in the unified list: first tee-off, else startDate. */
  sortKey: string;
};

/**
 * The tournament-style card an event gets on the main tee-times page.
 * Its tee times are collapsed under it (they're excluded from the flat
 * list) — tap through to the hub for everything.
 */
export function EventCard({ event }: { event: EventCardData }) {
  return (
    <Link
      href={`/events/${event.id}`}
      className="block rounded-lg border-2 border-emerald-700/60 bg-white p-4 shadow-sm hover:border-emerald-700 dark:border-emerald-500/50 dark:bg-gray-900 dark:hover:border-emerald-500"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-bold text-gray-900 dark:text-gray-100">
          ⛳ {event.name}
        </h2>
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
          {formatRange(new Date(event.startDate), new Date(event.endDate))}
        </span>
      </div>
      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-sm">
        {event.status === "ACTIVE" && (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
            live
          </span>
        )}
        {event.leaderLine ? (
          <span className="font-semibold text-emerald-700 dark:text-emerald-400">
            {event.leaderLine}
          </span>
        ) : (
          event.location && (
            <span className="text-gray-600 dark:text-gray-300">
              {event.location}
            </span>
          )
        )}
      </div>
      {event.rounds.length > 0 && (
        <ul className="mt-2 space-y-1 border-t border-gray-100 pt-2 text-xs text-gray-600 dark:border-gray-800 dark:text-gray-300">
          {event.rounds.map((r) => (
            <li key={r.id} className="flex items-baseline gap-1.5">
              <span className="font-semibold text-gray-500 dark:text-gray-400">
                {r.label}
              </span>
              <span>
                {r.teeOffs.length > 0 ? formatTeeOffs(r.teeOffs) : "TBD"}
              </span>
              {r.course && (
                <span className="truncate text-gray-400 dark:text-gray-500">
                  · {r.course}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Link>
  );
}

function formatTeeOffs(isos: string[]): string {
  const first = new Date(isos[0]);
  const day = first.toLocaleDateString("en-US", {
    weekday: "short",
    timeZone: APP_TZ,
  });
  const times = isos
    .map((iso) =>
      new Date(iso).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: APP_TZ,
      })
    )
    .join(" & ");
  return `${day} ${times}`;
}

function formatRange(start: Date, end: Date): string {
  const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) =>
    d.toLocaleDateString("en-US", { timeZone: "UTC", ...opts });
  if (start.getTime() === end.getTime()) {
    return fmt(start, { month: "short", day: "numeric" });
  }
  const sameMonth =
    start.getUTCFullYear() === end.getUTCFullYear() &&
    start.getUTCMonth() === end.getUTCMonth();
  if (sameMonth) {
    return `${fmt(start, { month: "short", day: "numeric" })}–${fmt(end, {
      day: "numeric",
    })}`;
  }
  return `${fmt(start, { month: "short", day: "numeric" })} – ${fmt(end, {
    month: "short",
    day: "numeric",
  })}`;
}

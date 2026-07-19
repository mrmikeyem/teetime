import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin";
import { eventStatus } from "@/lib/golf-events";
import { AutoRefresh } from "../tee-times/auto-refresh";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  ACTIVE:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  UPCOMING: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
  COMPLETE: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

export default async function EventsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const [admin, events] = await Promise.all([
    isAdmin(),
    prisma.event.findMany({
      orderBy: { startDate: "desc" },
      include: {
        rounds: { include: { teeTimes: { select: { course: true } } } },
        participants: { select: { id: true } },
      },
    }),
  ]);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 space-y-6">
      <header className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold sm:text-2xl">Events</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 sm:text-sm">
            Trips, weekends, and multi-round competitions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {admin && (
            <Link
              href="/events/new"
              className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
            >
              + New event
            </Link>
          )}
          <Link
            href="/tee-times"
            className="rounded-lg bg-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
          >
            ← Tee times
          </Link>
        </div>
      </header>

      {events.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
          No events yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {events.map((ev) => {
            const status = eventStatus(ev);
            const courses = Array.from(
              new Set(
                ev.rounds.flatMap((r) => r.teeTimes.map((t) => t.course))
              )
            );
            return (
              <li
                key={ev.id}
                className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900"
              >
                <Link href={`/events/${ev.id}`} className="block space-y-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <h2 className="font-semibold">⛳ {ev.name}</h2>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLE[status]}`}
                    >
                      {status.toLowerCase()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    {formatRange(ev.startDate, ev.endDate)}
                    {ev.location ? ` · ${ev.location}` : ""}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {ev.rounds.length} round{ev.rounds.length === 1 ? "" : "s"}
                    {courses.length > 0 ? ` at ${courses.join(" & ")}` : ""} ·{" "}
                    {ev.participants.length} player
                    {ev.participants.length === 1 ? "" : "s"}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      <AutoRefresh />
    </main>
  );
}

/** @db.Date values are UTC midnight — format in UTC so the day never shifts. */
function formatRange(start: Date, end: Date): string {
  const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) =>
    d.toLocaleDateString("en-US", { timeZone: "UTC", ...opts });
  const sameMonth =
    start.getUTCFullYear() === end.getUTCFullYear() &&
    start.getUTCMonth() === end.getUTCMonth();
  if (start.getTime() === end.getTime()) {
    return fmt(start, { month: "short", day: "numeric", year: "numeric" });
  }
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

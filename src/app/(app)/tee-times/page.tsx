import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Logo } from "@/app/components/logo";
import { isoDateInAppTz, startOfTodayInAppTz } from "@/lib/time";
import {
  computeStandings,
  eventStatus,
  getEventForHub,
} from "@/lib/golf-events";
import { ListWithCalendar, type TeeTimeListItem } from "./list-with-calendar";
import { AutoRefresh } from "./auto-refresh";
import { NotificationBell } from "./notification-bell";
import { HeaderMenu } from "./header-menu";
import type { EventCardData } from "./event-card";
import { getResolvedFeed } from "@/lib/notification-feed";
import {
  GRAND_FORKS,
  getDailyWeatherGrid,
  getWeatherForTeeTime,
  type WeatherSummary,
} from "@/lib/weather";

export const dynamic = "force-dynamic";

export default async function TeeTimesPage() {
  const session = await auth();
  if (!session) redirect("/login");

  // Feed, tee-time list, and live-event ids are independent — run them
  // concurrently rather than serializing query round-trips.
  const [{ items: feedItems, unread: unreadCount }, teeTimes, liveEventIds] =
    await Promise.all([
      getResolvedFeed(session.user.id, 10),
      prisma.teeTime.findMany({
        orderBy: { teeOffAt: "asc" },
        where: { teeOffAt: { gte: startOfTodayInAppTz() } },
        include: {
          creator: { select: { id: true, name: true } },
          members: {
            include: {
              user: { select: { id: true, name: true } },
              guest: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: "asc" },
          },
        },
      }),
      prisma.event.findMany({
        where: {
          endDate: { gte: new Date(`${isoDateInAppTz(new Date())}T00:00:00Z`) },
        },
        orderBy: { startDate: "asc" },
        select: { id: true },
      }),
    ]);

  // Active/upcoming events render as tournament-style cards slotted into the
  // list chronologically (their tee times collapse under them).
  const eventCards: EventCardData[] = (
    await Promise.all(liveEventIds.map(({ id }) => getEventForHub(id)))
  )
    .filter((ev): ev is NonNullable<typeof ev> => ev != null)
    .map((ev) => {
      const teeOffs = ev.rounds.flatMap((r) =>
        r.teeTimes.map((t) => t.teeOffAt.getTime())
      );
      return {
        id: ev.id,
        name: ev.name,
        startDate: ev.startDate.toISOString(),
        endDate: ev.endDate.toISOString(),
        location: ev.location,
        status: eventStatus(ev),
        leaderLine: computeStandings(ev).leaderLine,
        rounds: ev.rounds.map((r) => ({
          id: r.id,
          label: r.name ?? `Rd ${r.seq}`,
          course: r.teeTimes[0]?.course ?? null,
          teeOffs: r.teeTimes.map((t) => t.teeOffAt.toISOString()),
        })),
        sortKey: teeOffs.length
          ? new Date(Math.min(...teeOffs)).toISOString()
          : ev.startDate.toISOString(),
      };
    });

  const weatherByTeeId = new Map<string, WeatherSummary | null>();
  await Promise.all(
    teeTimes.map(async (t) => {
      if (t.lat == null || t.lon == null) {
        weatherByTeeId.set(t.id, null);
        return;
      }
      try {
        const w = await getWeatherForTeeTime(
          { lat: t.lat, lon: t.lon },
          t.teeOffAt
        );
        weatherByTeeId.set(t.id, w);
      } catch {
        weatherByTeeId.set(t.id, null);
      }
    })
  );

  const dailyGridEntries = await getDailyWeatherGrid(GRAND_FORKS).catch(
    () => new Map()
  );
  const dailyGrid = Array.from(dailyGridEntries.entries()).map(([date, w]) => ({
    date,
    tempF: w.tempF,
    icon: w.icon,
    condition: w.condition,
  }));

  const listItems: TeeTimeListItem[] = teeTimes.map((t) => ({
    id: t.id,
    course: t.course,
    name: t.name,
    teeOffAt: t.teeOffAt.toISOString(),
    partySize: t.partySize,
    teamSize: t.teamSize,
    type: t.type,
    creatorName: t.creator.name,
    // Event tee times stay out of the flat list (they collapse under their
    // event's card) but still feed the browse calendar.
    inEvent: t.eventRoundId != null,
    members: t.members.map((m) => ({
      name: m.user?.name ?? m.guest?.name ?? "(unknown)",
      confirmed: m.confirmed,
    })),
    weather: weatherByTeeId.get(t.id) ?? null,
  }));

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 space-y-6">
      <header className="flex items-center gap-2 sm:gap-3">
        <Logo size={56} className="h-10 w-10 shrink-0 sm:h-12 sm:w-12" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold leading-tight sm:text-2xl">
            Tee Time Tracker
          </h1>
          <p className="truncate text-xs text-gray-500 dark:text-gray-400 sm:text-sm">
            Hi {session.user.name}.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <NotificationBell
            initialItems={feedItems}
            initialUnread={unreadCount}
          />
          <HeaderMenu isAdmin={session.user.role === "ADMIN"}>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button
                type="submit"
                className="block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                Sign out
              </button>
            </form>
          </HeaderMenu>
        </div>
      </header>

      <Link
        href="/tee-times/new"
        className="block rounded-lg bg-emerald-700 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-emerald-800"
      >
        + New tee time
      </Link>

      <ListWithCalendar
        teeTimes={listItems}
        events={eventCards}
        dailyWeather={dailyGrid}
      />
      <AutoRefresh />
    </main>
  );
}


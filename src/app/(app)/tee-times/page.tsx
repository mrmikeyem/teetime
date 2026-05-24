import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Logo } from "@/app/components/logo";
import { startOfTodayInAppTz } from "@/lib/time";
import { ListWithCalendar, type TeeTimeListItem } from "./list-with-calendar";
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

  const teeTimes = await prisma.teeTime.findMany({
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
    teeOffAt: t.teeOffAt.toISOString(),
    partySize: t.partySize,
    creatorName: t.creator.name,
    members: t.members.map((m) => ({
      name: m.user?.name ?? m.guest?.name ?? "(unknown)",
      confirmed: m.confirmed,
    })),
    weather: weatherByTeeId.get(t.id) ?? null,
  }));

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 space-y-6">
      <header className="space-y-3">
        <div className="flex items-center gap-2 sm:gap-3">
          <Logo size={56} className="h-10 w-10 shrink-0 sm:h-12 sm:w-12" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold leading-tight sm:text-2xl">
              Tee Time Tracker
            </h1>
            <p className="truncate text-xs text-gray-500 dark:text-gray-400 sm:text-sm">
              Hi {session.user.name}.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/profile"
            className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
          >
            Profile
          </Link>
          {session.user.role === "ADMIN" && (
            <Link
              href="/admin"
              className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
            >
              Admin
            </Link>
          )}
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
            className="ml-auto"
          >
            <button
              type="submit"
              className="rounded-lg bg-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <Link
        href="/tee-times/new"
        className="block rounded-lg bg-emerald-700 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-emerald-800"
      >
        + New tee time
      </Link>

      <ListWithCalendar teeTimes={listItems} dailyWeather={dailyGrid} />
    </main>
  );
}


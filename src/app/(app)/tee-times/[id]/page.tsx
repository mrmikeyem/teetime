import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AddMember } from "./add-member";
import { MemberRow } from "./member-row";
import { Countdown } from "../countdown";
import { DeleteButton } from "./delete-button";
import { JoinButton } from "./join-button";
import { WeatherChip } from "../weather-chip";
import { getWeatherForTeeTime } from "@/lib/weather";

export const dynamic = "force-dynamic";

export default async function TeeTimeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;

  const teeTime = await prisma.teeTime.findUnique({
    where: { id },
    include: {
      creator: { select: { id: true, name: true } },
      members: {
        include: {
          user: { select: { id: true, name: true } },
          guest: { select: { id: true, name: true } },
          adder: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!teeTime) notFound();

  const excludeUserIds = teeTime.members
    .map((m) => m.userId)
    .filter((id): id is string => id !== null);
  const excludeGuestIds = teeTime.members
    .map((m) => m.guestId)
    .filter((id): id is string => id !== null);

  const isCurrentUserMember = excludeUserIds.includes(session.user.id);
  const isPastTeeTime = teeTime.teeOffAt.getTime() < Date.now();

  const confirmedCount = teeTime.members.filter((m) => m.confirmed).length;
  const overCapacity = teeTime.members.length > teeTime.partySize;
  const tooManyConfirmed = confirmedCount > teeTime.partySize;

  const weather =
    teeTime.lat != null && teeTime.lon != null
      ? await getWeatherForTeeTime(
          { lat: teeTime.lat, lon: teeTime.lon },
          teeTime.teeOffAt
        ).catch(() => null)
      : null;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 space-y-6">
      <Link href="/tee-times" className="text-sm text-emerald-700 hover:underline">
        ← All tee times
      </Link>

      <header className="space-y-2">
        <h1 className="text-2xl font-bold">{teeTime.course}</h1>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {formatDateTime(teeTime.teeOffAt)} — booked by {teeTime.creator.name}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              tooManyConfirmed
                ? "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300"
                : confirmedCount === teeTime.partySize
                ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300"
                : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200"
            }`}
          >
            {confirmedCount}/{teeTime.partySize} confirmed
            {tooManyConfirmed && " · over"}
          </span>
          {overCapacity && (
            <span
              className="rounded-full bg-amber-100 dark:bg-amber-900/40 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:text-amber-300"
              title={`${teeTime.members.length} signed up for a party of ${teeTime.partySize}`}
            >
              ⚠️ Overbooked · {teeTime.members.length}/{teeTime.partySize}
            </span>
          )}
          <Countdown
            teeOffAt={teeTime.teeOffAt.toISOString()}
            className="rounded-full bg-emerald-50 dark:bg-emerald-900/30 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300"
          />
          {weather && <WeatherChip weather={weather} />}
        </div>
        {teeTime.notes && (
          <p className="mt-2 rounded-lg bg-gray-50 dark:bg-gray-800/50 p-3 text-sm text-gray-700 dark:text-gray-200">
            {teeTime.notes}
          </p>
        )}
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Group ({teeTime.members.length} player{teeTime.members.length === 1 ? "" : "s"})
        </h2>
        {teeTime.members.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No one signed up yet.</p>
        ) : (
          <ul className="space-y-2">
            {teeTime.members.map((m) => {
              const isUser = m.userId !== null && m.user;
              const displayName = isUser ? m.user!.name : m.guest!.name;
              const memberKind: "user" | "guest" = isUser ? "user" : "guest";
              const memberId = isUser ? m.userId! : m.guestId!;
              const addedByLabel =
                isUser && m.adder.id === m.userId ? "self" : m.adder.name;

              return (
                <MemberRow
                  key={m.id}
                  teeTimeId={teeTime.id}
                  memberKind={memberKind}
                  memberId={memberId}
                  name={displayName}
                  isGuest={!isUser}
                  confirmed={m.confirmed}
                  addedByLabel={addedByLabel}
                />
              );
            })}
          </ul>
        )}
      </section>

      {!isCurrentUserMember && !isPastTeeTime && (
        <JoinButton teeTimeId={teeTime.id} userId={session.user.id} />
      )}

      <AddMember
        teeTimeId={teeTime.id}
        excludeUserIds={excludeUserIds}
        excludeGuestIds={excludeGuestIds}
      />

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-gray-200 dark:border-gray-700 pt-4">
        <Link
          href={`/tee-times/${teeTime.id}/edit`}
          className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
        >
          Edit
        </Link>
        <DeleteButton teeTimeId={teeTime.id} />
      </div>
    </main>
  );
}

function formatDateTime(d: Date) {
  return d.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Chicago",
  });
}

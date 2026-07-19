import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin";
import { recordNotification } from "@/lib/notification-feed";
import { sendPushToUser } from "@/lib/push";
import { broadcastChange } from "@/lib/events";

/**
 * The ONE schedule nudge. The schedule builder deliberately skips the
 * per-tee-time notifyNewTeeTime fan-out (six tee times = six nudges);
 * instead the admin fires this once when the schedule is ready. Goes to
 * every user — including EVENT-role users, since it's their event.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }
  const { id } = await params;

  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      rounds: { include: { teeTimes: { select: { course: true } } } },
    },
  });
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const courses = Array.from(
    new Set(event.rounds.flatMap((r) => r.teeTimes.map((t) => t.course)))
  );
  const roundCount = event.rounds.length;
  const body =
    roundCount > 0
      ? `${roundCount} round${roundCount === 1 ? "" : "s"}${
          courses.length ? ` at ${courses.join(" & ")}` : ""
        }`
      : "Details on the event page";
  const url = `/events/${event.id}`;

  const users = await prisma.user.findMany({
    where: { id: { not: session.user.id } },
    select: { id: true },
  });

  await Promise.all(
    users.map((u) =>
      recordNotification({
        userId: u.id,
        type: "announcement",
        title: `${event.name} — schedule is up`,
        body,
        url,
      })
    )
  );
  await Promise.allSettled(
    users.map((u) =>
      sendPushToUser(u.id, {
        title: `${event.name} — schedule is up`,
        body,
        url,
        tag: `event-announce-${event.id}`,
      })
    )
  );

  broadcastChange();
  return NextResponse.json({ ok: true, notified: users.length });
}

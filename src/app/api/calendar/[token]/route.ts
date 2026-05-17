import { prisma } from "@/lib/prisma";
import { buildIcs } from "@/lib/ics";
import { startOfTodayInAppTz } from "@/lib/time";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  // Basic shape check — tokens are 32-byte base64url (~43 chars). Reject
  // anything that looks like a typo before hitting the DB.
  if (!token || token.length < 20 || token.length > 128) {
    return notFound();
  }

  const user = await prisma.user.findUnique({
    where: { calendarFeedToken: token },
    select: { id: true, name: true },
  });

  if (!user) return notFound();

  const events = await prisma.teeTime.findMany({
    where: {
      teeOffAt: { gte: startOfTodayInAppTz() },
      members: { some: { userId: user.id } },
    },
    orderBy: { teeOffAt: "asc" },
    select: {
      id: true,
      course: true,
      teeOffAt: true,
      updatedAt: true,
      notes: true,
    },
  });

  const ics = buildIcs({
    calendarName: `Tee Times — ${user.name}`,
    events,
  });

  return new Response(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="tee-times.ics"',
      // Clients that honor this poll the feed periodically. Short cache
      // so edits propagate quickly. Calendar apps still respect their
      // own refresh schedule but won't hammer us.
      "Cache-Control": "private, max-age=300",
    },
  });
}

function notFound() {
  return new Response("Not found", {
    status: 404,
    headers: { "Content-Type": "text/plain" },
  });
}

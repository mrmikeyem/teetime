import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Admin: set a sim venue's host and standing night. A host makes every night
 * there need their OK; a standing day + time (both or neither) gets proposed
 * to the host each Monday. No host = books like a normal course.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    hostUserId?: string | null;
    standingDay?: number | null;
    standingTime?: string | null;
  };

  const hostUserId = body.hostUserId || null;
  const standingDay = body.standingDay ?? null;
  const standingTime = body.standingTime || null;

  if (hostUserId) {
    const user = await prisma.user.findUnique({ where: { id: hostUserId } });
    if (!user) {
      return NextResponse.json({ error: "Host not found" }, { status: 400 });
    }
  }
  if ((standingDay == null) !== (standingTime == null)) {
    return NextResponse.json(
      { error: "Standing night needs both a day and a time (or neither)" },
      { status: 400 }
    );
  }
  if (
    standingDay != null &&
    (!Number.isInteger(standingDay) || standingDay < 0 || standingDay > 6)
  ) {
    return NextResponse.json({ error: "Invalid day" }, { status: 400 });
  }
  if (standingTime != null && !TIME_RE.test(standingTime)) {
    return NextResponse.json({ error: "Invalid time" }, { status: 400 });
  }
  if (standingDay != null && !hostUserId) {
    return NextResponse.json(
      { error: "A standing night needs a host to OK it" },
      { status: 400 }
    );
  }

  const result = await prisma.simVenue.updateMany({
    where: { id },
    data: { hostUserId, standingDay, standingTime },
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "Venue not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

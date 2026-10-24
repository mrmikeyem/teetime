import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { geocodeCourse } from "@/lib/weather";
import { parseTournamentFields } from "@/lib/tournament";
import { TeeTimeType } from "@prisma/client";
import { broadcastChange } from "@/lib/events";
import { cancelSimNight } from "@/lib/sim-nights";
import { notifySimNightRequest } from "@/lib/notification-events";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // A hosted sim night is the host's to call off — and calling it off keeps
  // the row as CANCELLED so the group sees it. The only hard delete is the
  // requester withdrawing a request the host hasn't answered yet.
  const sim = await prisma.teeTime.findUnique({
    where: { id },
    select: {
      simStatus: true,
      createdBy: true,
      simVenue: { select: { hostUserId: true } },
    },
  });
  if (sim?.simStatus != null) {
    if (sim.simVenue?.hostUserId === session.user.id) {
      try {
        await cancelSimNight(session.user.id, id);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Couldn't cancel";
        return NextResponse.json({ error: message }, { status: 409 });
      }
      return NextResponse.json({ ok: true, cancelled: true });
    }
    if (!(sim.simStatus === "PENDING" && sim.createdBy === session.user.id)) {
      return NextResponse.json(
        { error: "Only the host can call off a sim night" },
        { status: 403 }
      );
    }
  }

  const result = await prisma.teeTime.deleteMany({ where: { id } });
  if (result.count === 0) {
    return NextResponse.json({ error: "Tee time not found" }, { status: 404 });
  }

  broadcastChange(id);

  return NextResponse.json({ ok: true });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const { teeOffAt, partySize, notes } = body;

  const existing = await prisma.teeTime.findUnique({
    where: { id },
    select: {
      course: true,
      teeOffAt: true,
      type: true,
      simStatus: true,
      simVenue: { select: { hostUserId: true } },
    },
  });
  if (!existing) {
    return NextResponse.json({ error: "Tee time not found" }, { status: 404 });
  }

  // Sim ↔ golf conversion isn't supported (venue + host status would need
  // inventing); a sim night keeps its venue as its course.
  const isSim = existing.type === TeeTimeType.SIM;
  if (isSim !== (body.type === "SIM")) {
    return NextResponse.json(
      { error: "A sim night can't be switched to or from a golf tee time" },
      { status: 400 }
    );
  }
  const course: string = isSim ? existing.course : body.course;

  if (!course?.trim() || !teeOffAt) {
    return NextResponse.json(
      { error: "Course and tee-off time are required" },
      { status: 400 }
    );
  }

  const when = new Date(teeOffAt);
  if (isNaN(when.getTime())) {
    return NextResponse.json({ error: "Invalid tee-off time" }, { status: 400 });
  }

  const tournament = parseTournamentFields(body);
  if ("error" in tournament) {
    return NextResponse.json({ error: tournament.error }, { status: 400 });
  }

  let size: number | null;
  if (tournament.type === TeeTimeType.TOURNAMENT) {
    if (partySize == null || partySize === "") {
      size = null;
    } else if (!Number.isInteger(partySize) || partySize < 1) {
      return NextResponse.json(
        { error: "Party size must be a positive integer" },
        { status: 400 }
      );
    } else {
      size = partySize;
    }
  } else if (isSim) {
    size = Number.isInteger(partySize) ? partySize : 4;
    if (size! < 1 || size! > 8) {
      return NextResponse.json(
        { error: "Party size must be between 1 and 8" },
        { status: 400 }
      );
    }
  } else {
    size = Number.isInteger(partySize) ? partySize : 4;
    if (size! < 1 || size! > 5) {
      return NextResponse.json(
        { error: "Party size must be between 1 and 5" },
        { status: 400 }
      );
    }
  }

  const courseChanged = existing.course !== course.trim();
  const timeChanged = existing.teeOffAt.getTime() !== when.getTime();

  // Moving a hosted sim night to a new time is the host's call too: anyone
  // else's move sends it back to PENDING for the host to OK.
  const needsHostOk =
    existing.simStatus != null &&
    timeChanged &&
    existing.simVenue?.hostUserId !== session.user.id;

  // Re-geocode if course changed; preserve existing coords otherwise.
  const coords = courseChanged && !isSim
    ? await geocodeCourse(course.trim()).catch(() => null)
    : undefined;

  await prisma.teeTime.update({
    where: { id },
    data: {
      course: course.trim(),
      teeOffAt: when,
      partySize: size,
      type: tournament.type,
      name: tournament.name,
      teamSize: tournament.teamSize,
      externalUrl: tournament.externalUrl,
      signupDeadline: tournament.signupDeadline,
      rangeOpensTime: tournament.rangeOpensTime,
      isShotgun: tournament.isShotgun,
      format: tournament.format,
      entryFee: tournament.entryFee,
      notes: notes ?? null,
      ...(coords ? { lat: coords.lat, lon: coords.lon } : {}),
      ...(needsHostOk ? { simStatus: "PENDING" as const } : {}),
    },
  });

  // If the tee-off time moved, clear remindedAt on all members so the
  // 1-hour-prior reminder will fire for the new time.
  if (timeChanged) {
    await prisma.teeTimeMember.updateMany({
      where: { teeTimeId: id },
      data: { remindedAt: null },
    });
  }

  broadcastChange(id);

  if (needsHostOk) {
    await notifySimNightRequest({ teeTimeId: id, requestedByUserId: session.user.id });
  }

  return NextResponse.json({ ok: true });
}

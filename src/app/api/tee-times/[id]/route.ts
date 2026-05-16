import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { geocodeCourse } from "@/lib/weather";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const result = await prisma.teeTime.deleteMany({ where: { id } });
  if (result.count === 0) {
    return NextResponse.json({ error: "Tee time not found" }, { status: 404 });
  }

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
  const { course, teeOffAt, partySize, notes } = await req.json();

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

  const size = Number.isInteger(partySize) ? partySize : 4;
  if (size < 1 || size > 5) {
    return NextResponse.json(
      { error: "Party size must be between 1 and 5" },
      { status: 400 }
    );
  }

  const existing = await prisma.teeTime.findUnique({
    where: { id },
    select: { course: true, teeOffAt: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Tee time not found" }, { status: 404 });
  }

  const courseChanged = existing.course !== course.trim();
  const timeChanged = existing.teeOffAt.getTime() !== when.getTime();

  // Re-geocode if course changed; preserve existing coords otherwise.
  const coords = courseChanged
    ? await geocodeCourse(course.trim()).catch(() => null)
    : undefined;

  await prisma.teeTime.update({
    where: { id },
    data: {
      course: course.trim(),
      teeOffAt: when,
      partySize: size,
      notes: notes ?? null,
      ...(coords ? { lat: coords.lat, lon: coords.lon } : {}),
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

  return NextResponse.json({ ok: true });
}

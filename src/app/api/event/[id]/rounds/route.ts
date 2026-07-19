import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin";
import { geocodeCourse } from "@/lib/weather";
import { appTzWallTimeToUtc } from "@/lib/time";
import { broadcastChange } from "@/lib/events";
import { TournamentFormat } from "@prisma/client";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const VALID_FORMATS = new Set<string>(Object.values(TournamentFormat));

/**
 * Schedule builder: create a round and spawn its tee times in one shot.
 * Body: { name?, format?, course, date: "YYYY-MM-DD", times: ["15:00", ...],
 *         partySize? }. Deliberately does NOT fire notifyNewTeeTime — the
 * admin announces the whole schedule once via POST /api/event/[id]/announce.
 */
export async function POST(
  req: Request,
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
    select: { id: true, rounds: { select: { seq: true } } },
  });
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const body = await req.json();

  const course = typeof body.course === "string" ? body.course.trim() : "";
  if (!course) {
    return NextResponse.json({ error: "Course is required" }, { status: 400 });
  }
  const date = typeof body.date === "string" ? body.date : "";
  if (!DATE_RE.test(date)) {
    return NextResponse.json({ error: "A date is required" }, { status: 400 });
  }
  const rawTimes: unknown[] = Array.isArray(body.times) ? body.times : [];
  const times = Array.from(
    new Set(rawTimes.filter((t): t is string => typeof t === "string"))
  );
  if (times.length === 0 || times.some((t) => !TIME_RE.test(t))) {
    return NextResponse.json(
      { error: "At least one tee-off time (HH:MM) is required" },
      { status: 400 }
    );
  }

  let format: TournamentFormat | null = null;
  if (body.format != null && body.format !== "") {
    if (typeof body.format !== "string" || !VALID_FORMATS.has(body.format)) {
      return NextResponse.json({ error: "Invalid format" }, { status: 400 });
    }
    format = body.format as TournamentFormat;
  }

  let partySize = 4;
  if (body.partySize != null && body.partySize !== "") {
    const n = Number(body.partySize);
    if (!Number.isInteger(n) || n < 1 || n > 5) {
      return NextResponse.json(
        { error: "Party size must be between 1 and 5" },
        { status: 400 }
      );
    }
    partySize = n;
  }

  const name =
    typeof body.name === "string" && body.name.trim() ? body.name.trim() : null;

  const coords = await geocodeCourse(course).catch(() => null);
  const nextSeq =
    event.rounds.reduce((max, r) => Math.max(max, r.seq), 0) + 1;

  const round = await prisma.eventRound.create({
    data: {
      eventId: id,
      seq: nextSeq,
      name,
      format,
      teeTimes: {
        create: times.sort().map((t) => ({
          course,
          teeOffAt: appTzWallTimeToUtc(date, t),
          partySize,
          lat: coords?.lat ?? null,
          lon: coords?.lon ?? null,
          createdBy: session.user.id,
        })),
      },
    },
    select: { id: true },
  });

  broadcastChange();
  return NextResponse.json({ id: round.id }, { status: 201 });
}

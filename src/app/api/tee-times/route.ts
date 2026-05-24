import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { geocodeCourse } from "@/lib/weather";
import { notifyAddedToTeeTime, notifyNewTeeTime } from "@/lib/notification-events";
import { parseTournamentFields } from "@/lib/tournament";
import { TeeTimeType } from "@prisma/client";

export async function POST(req: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { course, teeOffAt, partySize, notes, memberUserIds, memberGuestIds } =
    body;

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

  // partySize: required 1-5 for tee times, optional for tournaments
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
  } else {
    size = Number.isInteger(partySize) ? partySize : 4;
    if (size! < 1 || size! > 5) {
      return NextResponse.json(
        { error: "Party size must be between 1 and 5" },
        { status: 400 }
      );
    }
  }

  const creatorId = session.user.id;
  const extraUserIds = Array.from(
    new Set(
      Array.isArray(memberUserIds)
        ? memberUserIds.filter(
            (id) => typeof id === "string" && id !== creatorId
          )
        : []
    )
  );
  const extraGuestIds = Array.from(
    new Set(
      Array.isArray(memberGuestIds)
        ? memberGuestIds.filter((id) => typeof id === "string")
        : []
    )
  );

  const coords = await geocodeCourse(course.trim()).catch(() => null);

  const teeTime = await prisma.teeTime.create({
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
      lat: coords?.lat ?? null,
      lon: coords?.lon ?? null,
      notes: notes ?? null,
      createdBy: creatorId,
      members: {
        create: [
          { userId: creatorId, addedBy: creatorId, confirmed: true },
          ...extraUserIds.map((userId) => ({
            userId,
            addedBy: creatorId,
            confirmed: false,
          })),
          ...extraGuestIds.map((guestId) => ({
            guestId,
            addedBy: creatorId,
            confirmed: false,
          })),
        ],
      },
    },
  });

  await Promise.allSettled([
    ...extraUserIds.map((userId) =>
      notifyAddedToTeeTime({ userId, teeTimeId: teeTime.id, addedByUserId: creatorId })
    ),
    notifyNewTeeTime({ teeTimeId: teeTime.id, bookerUserId: creatorId }),
  ]);

  return NextResponse.json({ id: teeTime.id }, { status: 201 });
}

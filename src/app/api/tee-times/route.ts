import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { geocodeCourse } from "@/lib/weather";

export async function POST(req: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { course, teeOffAt, partySize, notes, memberUserIds } = await req.json();

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

  const creatorId = session.user.id;
  const extraMemberIds: string[] = Array.isArray(memberUserIds)
    ? memberUserIds.filter((id) => typeof id === "string" && id !== creatorId)
    : [];
  const uniqueExtraIds = Array.from(new Set(extraMemberIds));

  const coords = await geocodeCourse(course.trim()).catch(() => null);

  const teeTime = await prisma.teeTime.create({
    data: {
      course: course.trim(),
      teeOffAt: when,
      partySize: size,
      lat: coords?.lat ?? null,
      lon: coords?.lon ?? null,
      notes: notes ?? null,
      createdBy: creatorId,
      members: {
        create: [
          { userId: creatorId, addedBy: creatorId, confirmed: true },
          ...uniqueExtraIds.map((userId) => ({
            userId,
            addedBy: creatorId,
            confirmed: false,
          })),
        ],
      },
    },
  });

  return NextResponse.json({ id: teeTime.id }, { status: 201 });
}

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  notifyAddedToTeeTime,
  notifyMemberJoined,
  notifyMemberLeft,
} from "@/lib/notification-events";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: teeTimeId } = await params;
  const { userId, guestId } = await req.json();

  if (!userId && !guestId) {
    return NextResponse.json(
      { error: "userId or guestId is required" },
      { status: 400 }
    );
  }
  if (userId && guestId) {
    return NextResponse.json(
      { error: "Cannot specify both userId and guestId" },
      { status: 400 }
    );
  }

  const teeTime = await prisma.teeTime.findUnique({ where: { id: teeTimeId } });
  if (!teeTime) {
    return NextResponse.json({ error: "Tee time not found" }, { status: 404 });
  }

  if (userId) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
  } else {
    const guest = await prisma.guest.findUnique({ where: { id: guestId } });
    if (!guest) {
      return NextResponse.json({ error: "Guest not found" }, { status: 404 });
    }
  }

  try {
    await prisma.teeTimeMember.create({
      data: {
        teeTimeId,
        userId: userId ?? null,
        guestId: guestId ?? null,
        addedBy: session.user.id,
        confirmed: !!userId && userId === session.user.id,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Already in this tee time" },
      { status: 409 }
    );
  }

  if (userId) {
    // Tell the new member (if added by someone else) and tell the rest of the group.
    // The helper functions skip themselves where appropriate.
    await Promise.allSettled([
      notifyAddedToTeeTime({
        userId,
        teeTimeId,
        addedByUserId: session.user.id,
      }),
      notifyMemberJoined({
        teeTimeId,
        joinerUserId: userId,
        actorUserId: session.user.id,
      }),
    ]);
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: teeTimeId } = await params;
  const { userId, guestId, confirmed } = await req.json();

  if ((!userId && !guestId) || typeof confirmed !== "boolean") {
    return NextResponse.json(
      { error: "userId or guestId, plus confirmed (boolean) required" },
      { status: 400 }
    );
  }

  const where = userId
    ? { teeTimeId, userId: userId as string }
    : { teeTimeId, guestId: guestId as string };

  const result = await prisma.teeTimeMember.updateMany({
    where,
    data: { confirmed },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: teeTimeId } = await params;
  const { userId, guestId } = await req.json();

  if (!userId && !guestId) {
    return NextResponse.json(
      { error: "userId or guestId is required" },
      { status: 400 }
    );
  }

  // Load context BEFORE delete so we have the leaver's name and the remaining roster.
  const teeTime = await prisma.teeTime.findUnique({
    where: { id: teeTimeId },
    include: {
      members: {
        include: {
          user: { select: { id: true, name: true } },
          guest: { select: { name: true } },
        },
      },
    },
  });

  const leaverMember = teeTime?.members.find((m) =>
    userId ? m.userId === userId : m.guestId === guestId
  );
  const leaverName =
    leaverMember?.user?.name ?? leaverMember?.guest?.name ?? "Someone";
  const remainingUserIds =
    teeTime?.members
      .filter((m) =>
        userId ? m.userId !== userId : m.guestId !== guestId
      )
      .map((m) => m.userId)
      .filter((id): id is string => !!id) ?? [];

  const where = userId
    ? { teeTimeId, userId: userId as string }
    : { teeTimeId, guestId: guestId as string };

  const result = await prisma.teeTimeMember.deleteMany({ where });

  if (result.count > 0 && teeTime) {
    await notifyMemberLeft({
      teeTimeId,
      leaverName,
      actorUserId: session.user.id,
      remainingMemberUserIds: remainingUserIds,
      course: teeTime.course,
      teeOffAt: teeTime.teeOffAt,
    });
  }

  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

  const where = userId
    ? { teeTimeId, userId: userId as string }
    : { teeTimeId, guestId: guestId as string };

  await prisma.teeTimeMember.deleteMany({ where });

  return NextResponse.json({ ok: true });
}

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
  const { userId } = await req.json();

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const teeTime = await prisma.teeTime.findUnique({ where: { id: teeTimeId } });
  if (!teeTime) {
    return NextResponse.json({ error: "Tee time not found" }, { status: 404 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  try {
    await prisma.teeTimeMember.create({
      data: {
        teeTimeId,
        userId,
        addedBy: session.user.id,
        confirmed: userId === session.user.id,
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
  const { userId, confirmed } = await req.json();

  if (!userId || typeof confirmed !== "boolean") {
    return NextResponse.json(
      { error: "userId and confirmed (boolean) are required" },
      { status: 400 }
    );
  }

  const result = await prisma.teeTimeMember.updateMany({
    where: { teeTimeId, userId },
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
  const { userId } = await req.json();

  await prisma.teeTimeMember.deleteMany({
    where: { teeTimeId, userId },
  });

  return NextResponse.json({ ok: true });
}

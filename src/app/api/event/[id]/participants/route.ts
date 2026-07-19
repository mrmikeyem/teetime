import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin";
import { broadcastChange } from "@/lib/events";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json();

  const raw: unknown[] = Array.isArray(body.userIds) ? body.userIds : [];
  const userIds = Array.from(
    new Set(raw.filter((u): u is string => typeof u === "string"))
  );
  if (userIds.length === 0) {
    return NextResponse.json({ error: "No users given" }, { status: 400 });
  }

  const event = await prisma.event.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  await prisma.eventParticipant.createMany({
    data: userIds.map((userId) => ({ eventId: id, userId })),
    skipDuplicates: true,
  });

  broadcastChange();
  return NextResponse.json({ ok: true }, { status: 201 });
}

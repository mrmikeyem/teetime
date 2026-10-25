import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { broadcastChange } from "@/lib/events";
import { canRemovePlayer, requireSimApi } from "@/lib/sim";

/** Check / uncheck a player ("playing tonight"). */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireSimApi();
  if (error) return error;
  const { id } = await params;
  const { checked } = await req.json();
  if (typeof checked !== "boolean") {
    return NextResponse.json({ error: "checked (boolean) required" }, { status: 400 });
  }
  const result = await prisma.simPlayer.updateMany({
    where: { id, archivedAt: null },
    data: { checked },
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }
  broadcastChange();
  return NextResponse.json({ ok: true });
}

/**
 * Remove a guest and their course list (members are never removed — see
 * canRemovePlayer). Guests with play history are archived (the log keeps
 * their name); others are deleted outright.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { viewer, error } = await requireSimApi();
  if (error) return error;
  const { id } = await params;

  const player = await prisma.simPlayer.findUnique({
    where: { id },
    select: { id: true, userId: true, _count: { select: { plays: true } } },
  });
  if (!player) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }
  if (!canRemovePlayer(viewer, player)) {
    return NextResponse.json({ error: "Only an admin can remove a guest" }, { status: 403 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.simListEntry.deleteMany({ where: { playerId: id } });
    if (player._count.plays > 0) {
      await tx.simPlayer.update({
        where: { id },
        data: { archivedAt: new Date(), checked: false },
      });
    } else {
      await tx.simPlayer.delete({ where: { id } });
    }
  });
  broadcastChange();
  return NextResponse.json({ ok: true });
}

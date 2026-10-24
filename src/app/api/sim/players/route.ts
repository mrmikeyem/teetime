import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { broadcastChange } from "@/lib/events";
import { requireSimApi } from "@/lib/sim";

/**
 * Add a wheel player: a member ({userId}) or a guest ({guestName}).
 * Re-adding an archived member restores them with their history.
 */
export async function POST(req: Request) {
  const { viewer, error } = await requireSimApi();
  if (error) return error;
  const body = await req.json();

  if (typeof body.userId === "string" && body.userId) {
    const user = await prisma.user.findUnique({
      where: { id: body.userId },
      select: { id: true, simPlayer: { select: { id: true, archivedAt: true } } },
    });
    if (!user) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }
    if (user.simPlayer && !user.simPlayer.archivedAt) {
      return NextResponse.json({ error: "Already on the wheel" }, { status: 409 });
    }
    if (user.simPlayer) {
      await prisma.simPlayer.update({
        where: { id: user.simPlayer.id },
        data: { archivedAt: null },
      });
    } else {
      await prisma.simPlayer.create({ data: { userId: user.id } });
    }
    broadcastChange();
    return NextResponse.json({ ok: true }, { status: 201 });
  }

  const guestName = typeof body.guestName === "string" ? body.guestName.trim() : "";
  if (!guestName) {
    return NextResponse.json(
      { error: "Pick a member or enter a guest name" },
      { status: 400 }
    );
  }
  await prisma.simPlayer.create({
    data: {
      guest: { create: { name: guestName, addedBy: viewer.id } },
    },
  });
  broadcastChange();
  return NextResponse.json({ ok: true }, { status: 201 });
}

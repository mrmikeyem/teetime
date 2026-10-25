import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { broadcastChange } from "@/lib/events";
import { requireSimApi } from "@/lib/sim";

/**
 * Add a guest to the wheel. Members aren't added here — every eligible
 * member is a player automatically (ensureMemberPlayers in lib/sim.ts).
 */
export async function POST(req: Request) {
  const { viewer, error } = await requireSimApi();
  if (error) return error;
  const body = await req.json();

  const guestName = typeof body.guestName === "string" ? body.guestName.trim() : "";
  if (!guestName) {
    return NextResponse.json(
      { error: "Enter a guest name" },
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

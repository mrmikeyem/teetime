import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { broadcastChange } from "@/lib/events";
import { EventGameType } from "@prisma/client";

const VALID_TYPES = new Set<string>(Object.values(EventGameType));

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await req.json();

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Game name is required" }, { status: 400 });
  }
  const type =
    typeof body.type === "string" && VALID_TYPES.has(body.type)
      ? (body.type as EventGameType)
      : EventGameType.CUSTOM;

  let hole: number | null = null;
  if (body.hole != null && body.hole !== "") {
    const n = Number(body.hole);
    if (!Number.isInteger(n) || n < 1 || n > 18) {
      return NextResponse.json({ error: "Hole must be 1-18" }, { status: 400 });
    }
    hole = n;
  }

  let roundId: string | null = null;
  if (typeof body.roundId === "string" && body.roundId) {
    const round = await prisma.eventRound.findFirst({
      where: { id: body.roundId, eventId: id },
      select: { id: true },
    });
    if (!round) {
      return NextResponse.json({ error: "Round not found" }, { status: 404 });
    }
    roundId = round.id;
  }

  const event = await prisma.event.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const game = await prisma.eventGame.create({
    data: {
      eventId: id,
      roundId,
      type,
      name,
      hole,
      payoutNote:
        typeof body.payoutNote === "string" && body.payoutNote.trim()
          ? body.payoutNote.trim()
          : null,
    },
    select: { id: true },
  });

  broadcastChange();
  return NextResponse.json({ id: game.id }, { status: 201 });
}

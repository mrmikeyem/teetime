import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { broadcastChange } from "@/lib/events";

function parseNine(v: unknown): number | null | "invalid" {
  if (v == null || v === "") return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 18 || n > 120) return "invalid";
  return n;
}

/**
 * Upsert a team's score for a round. Any signed-in user can enter or fix a
 * score (it's a private group app); enteredBy stamps accountability.
 * Body: { roundId, teamId, front9?, back9? }
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await req.json();

  const { roundId, teamId } = body;
  if (typeof roundId !== "string" || typeof teamId !== "string") {
    return NextResponse.json({ error: "Round and team required" }, { status: 400 });
  }

  const front9 = parseNine(body.front9);
  const back9 = parseNine(body.back9);
  if (front9 === "invalid" || back9 === "invalid") {
    return NextResponse.json(
      { error: "Nine-hole scores must be between 18 and 120" },
      { status: 400 }
    );
  }

  const [round, team] = await Promise.all([
    prisma.eventRound.findFirst({
      where: { id: roundId, eventId: id },
      select: { id: true },
    }),
    prisma.eventTeam.findFirst({
      where: { id: teamId, eventId: id },
      select: { id: true },
    }),
  ]);
  if (!round || !team) {
    return NextResponse.json({ error: "Round or team not found" }, { status: 404 });
  }

  await prisma.eventScore.upsert({
    where: { roundId_teamId: { roundId, teamId } },
    create: { roundId, teamId, front9, back9, enteredBy: session.user.id },
    update: { front9, back9, enteredBy: session.user.id },
  });

  broadcastChange();
  return NextResponse.json({ ok: true });
}

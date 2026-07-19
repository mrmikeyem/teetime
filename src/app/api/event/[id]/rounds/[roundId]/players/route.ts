import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { broadcastChange } from "@/lib/events";

/**
 * Upsert a participant's per-round row: mulligan/drive toggles (anyone
 * signed in — it's the group's honesty board) and the per-round team
 * override for rotating-team formats.
 * Body: { participantId, mulliFront?, mulliBack?, driveUsed?, teamId? }
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; roundId: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id, roundId } = await params;
  const body = await req.json();

  const participantId = body.participantId;
  if (typeof participantId !== "string") {
    return NextResponse.json({ error: "Participant required" }, { status: 400 });
  }

  const [round, participant] = await Promise.all([
    prisma.eventRound.findFirst({
      where: { id: roundId, eventId: id },
      select: { id: true },
    }),
    prisma.eventParticipant.findFirst({
      where: { id: participantId, eventId: id },
      select: { id: true },
    }),
  ]);
  if (!round || !participant) {
    return NextResponse.json(
      { error: "Round or participant not found" },
      { status: 404 }
    );
  }

  const toggles: {
    mulliFront?: boolean;
    mulliBack?: boolean;
    driveUsed?: boolean;
    teamId?: string | null;
  } = {};
  if ("mulliFront" in body) toggles.mulliFront = !!body.mulliFront;
  if ("mulliBack" in body) toggles.mulliBack = !!body.mulliBack;
  if ("driveUsed" in body) toggles.driveUsed = !!body.driveUsed;
  if ("teamId" in body) {
    const teamId =
      typeof body.teamId === "string" && body.teamId ? body.teamId : null;
    if (teamId) {
      const team = await prisma.eventTeam.findFirst({
        where: { id: teamId, eventId: id },
        select: { id: true },
      });
      if (!team) {
        return NextResponse.json({ error: "Team not found" }, { status: 404 });
      }
    }
    toggles.teamId = teamId;
  }

  await prisma.eventRoundPlayer.upsert({
    where: { roundId_participantId: { roundId, participantId } },
    create: { roundId, participantId, ...toggles },
    update: toggles,
  });

  broadcastChange();
  return NextResponse.json({ ok: true });
}

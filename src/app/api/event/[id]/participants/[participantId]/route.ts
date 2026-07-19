import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin";
import { broadcastChange } from "@/lib/events";

/** Assign (or clear) a participant's event-level default team. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; participantId: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }
  const { id, participantId } = await params;
  const body = await req.json();

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

  const result = await prisma.eventParticipant.updateMany({
    where: { id: participantId, eventId: id },
    data: { teamId },
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "Participant not found" }, { status: 404 });
  }

  broadcastChange();
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; participantId: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }
  const { id, participantId } = await params;

  const result = await prisma.eventParticipant.deleteMany({
    where: { id: participantId, eventId: id },
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "Participant not found" }, { status: 404 });
  }

  broadcastChange();
  return NextResponse.json({ ok: true });
}

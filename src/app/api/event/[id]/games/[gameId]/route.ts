import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin";
import { broadcastChange } from "@/lib/events";

/**
 * Set/clear a game's winner (any signed-in user — scores land as the group
 * walks off the green) or its details. Body accepts:
 * { winnerParticipantId?, winnerTeamId?, name?, hole?, payoutNote?, points? }
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; gameId: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id, gameId } = await params;
  const body = await req.json();

  const data: Record<string, unknown> = {};

  if ("winnerParticipantId" in body) {
    const pid =
      typeof body.winnerParticipantId === "string" && body.winnerParticipantId
        ? body.winnerParticipantId
        : null;
    if (pid) {
      const p = await prisma.eventParticipant.findFirst({
        where: { id: pid, eventId: id },
        select: { id: true },
      });
      if (!p) {
        return NextResponse.json({ error: "Participant not found" }, { status: 404 });
      }
    }
    data.winnerParticipantId = pid;
  }
  if ("winnerTeamId" in body) {
    const tid =
      typeof body.winnerTeamId === "string" && body.winnerTeamId
        ? body.winnerTeamId
        : null;
    if (tid) {
      const t = await prisma.eventTeam.findFirst({
        where: { id: tid, eventId: id },
        select: { id: true },
      });
      if (!t) {
        return NextResponse.json({ error: "Team not found" }, { status: 404 });
      }
    }
    data.winnerTeamId = tid;
  }
  if ("name" in body) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "Game name is required" }, { status: 400 });
    }
    data.name = name;
  }
  if ("hole" in body) {
    if (body.hole == null || body.hole === "") {
      data.hole = null;
    } else {
      const n = Number(body.hole);
      if (!Number.isInteger(n) || n < 1 || n > 18) {
        return NextResponse.json({ error: "Hole must be 1-18" }, { status: 400 });
      }
      data.hole = n;
    }
  }
  if ("payoutNote" in body) {
    data.payoutNote =
      typeof body.payoutNote === "string" && body.payoutNote.trim()
        ? body.payoutNote.trim()
        : null;
  }
  if ("roundId" in body) {
    const rid =
      typeof body.roundId === "string" && body.roundId ? body.roundId : null;
    if (rid) {
      const round = await prisma.eventRound.findFirst({
        where: { id: rid, eventId: id },
        select: { id: true },
      });
      if (!round) {
        return NextResponse.json({ error: "Round not found" }, { status: 404 });
      }
    }
    data.roundId = rid;
  }
  if ("points" in body) {
    if (body.points == null || body.points === "") {
      data.points = null;
    } else {
      const n = Number(body.points);
      if (!Number.isInteger(n) || n < 1 || n > 100) {
        return NextResponse.json({ error: "Points must be 1-100" }, { status: 400 });
      }
      data.points = n;
    }
  }

  const result = await prisma.eventGame.updateMany({
    where: { id: gameId, eventId: id },
    data,
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  broadcastChange();
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; gameId: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }
  const { id, gameId } = await params;

  const result = await prisma.eventGame.deleteMany({
    where: { id: gameId, eventId: id },
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  broadcastChange();
  return NextResponse.json({ ok: true });
}

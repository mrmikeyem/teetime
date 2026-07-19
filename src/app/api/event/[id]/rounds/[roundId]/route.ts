import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin";
import { broadcastChange } from "@/lib/events";
import { TournamentFormat } from "@prisma/client";

const VALID_FORMATS = new Set<string>(Object.values(TournamentFormat));

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; roundId: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }
  const { id, roundId } = await params;
  const body = await req.json();

  const data: { name?: string | null; format?: TournamentFormat | null } = {};
  if ("name" in body) {
    data.name =
      typeof body.name === "string" && body.name.trim()
        ? body.name.trim()
        : null;
  }
  if ("format" in body) {
    if (body.format == null || body.format === "") {
      data.format = null;
    } else if (
      typeof body.format === "string" &&
      VALID_FORMATS.has(body.format)
    ) {
      data.format = body.format as TournamentFormat;
    } else {
      return NextResponse.json({ error: "Invalid format" }, { status: 400 });
    }
  }

  const result = await prisma.eventRound.updateMany({
    where: { id: roundId, eventId: id },
    data,
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "Round not found" }, { status: 404 });
  }

  broadcastChange();
  return NextResponse.json({ ok: true });
}

/**
 * Deleting a round DELETES its tee times too (they were spawned by the
 * schedule builder; orphaning them as regular tee times would leave
 * confusing duplicates if the admin rebuilds the round).
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; roundId: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }
  const { id, roundId } = await params;

  const round = await prisma.eventRound.findFirst({
    where: { id: roundId, eventId: id },
    select: { id: true },
  });
  if (!round) {
    return NextResponse.json({ error: "Round not found" }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.teeTime.deleteMany({ where: { eventRoundId: roundId } }),
    prisma.eventRound.delete({ where: { id: roundId } }),
  ]);

  broadcastChange();
  return NextResponse.json({ ok: true });
}

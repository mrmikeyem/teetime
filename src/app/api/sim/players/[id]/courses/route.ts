import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { broadcastChange } from "@/lib/events";
import { findOrCreateCourse, parseCourseInput, requireSimApi } from "@/lib/sim";

/** Add a course to the end of a player's list. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireSimApi();
  if (error) return error;
  const { id: playerId } = await params;
  const course = parseCourseInput(await req.json());
  if (!course) {
    return NextResponse.json({ error: "Course name is required" }, { status: 400 });
  }

  const player = await prisma.simPlayer.findFirst({
    where: { id: playerId, archivedAt: null },
    select: { id: true },
  });
  if (!player) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      const c = await findOrCreateCourse(tx, course);
      const last = await tx.simListEntry.findFirst({
        where: { playerId },
        orderBy: { position: "desc" },
        select: { position: true },
      });
      await tx.simListEntry.create({
        data: { playerId, courseId: c.id, position: (last?.position ?? -1) + 1 },
      });
    });
  } catch {
    return NextResponse.json(
      { error: "That course is already on this list" },
      { status: 409 }
    );
  }
  broadcastChange();
  return NextResponse.json({ ok: true }, { status: 201 });
}

/** Reorder a player's list: body is the full `entryIds` array, top first. */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireSimApi();
  if (error) return error;
  const { id: playerId } = await params;
  const { entryIds } = await req.json();
  if (!Array.isArray(entryIds) || !entryIds.every((x) => typeof x === "string")) {
    return NextResponse.json({ error: "entryIds required" }, { status: 400 });
  }

  const existing = await prisma.simListEntry.findMany({
    where: { playerId },
    select: { id: true },
  });
  const known = new Set(existing.map((e) => e.id));
  if (entryIds.length !== known.size || !entryIds.every((id) => known.has(id))) {
    return NextResponse.json(
      { error: "The list changed — refresh and try again" },
      { status: 409 }
    );
  }

  await prisma.$transaction(
    entryIds.map((id: string, position: number) =>
      prisma.simListEntry.update({ where: { id }, data: { position } })
    )
  );
  broadcastChange();
  return NextResponse.json({ ok: true });
}

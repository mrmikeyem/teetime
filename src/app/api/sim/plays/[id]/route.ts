import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { broadcastChange } from "@/lib/events";
import {
  findOrCreateCourse,
  parseCourseInput,
  parseTee,
  requireSimApi,
  teeColumns,
} from "@/lib/sim";
import { parsePlayFields } from "../fields";

/** Full edit of a play-log entry (course relink, date/time, tees, people, notes). */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireSimApi();
  if (error) return error;
  const { id } = await params;
  const body = await req.json();

  const course = parseCourseInput(body.course);
  if (!course) {
    return NextResponse.json({ error: "Course name is required" }, { status: 400 });
  }
  const fields = parsePlayFields(body);
  if ("error" in fields) {
    return NextResponse.json({ error: fields.error }, { status: 400 });
  }

  const exists = await prisma.simPlay.findUnique({ where: { id }, select: { id: true } });
  if (!exists) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    const c = await findOrCreateCourse(tx, course, { unlinked: body.unlinked === true });
    await tx.simPlayPlayer.deleteMany({ where: { playId: id } });
    await tx.simPlay.update({
      where: { id },
      data: {
        courseId: c.id,
        playedAt: fields.playedAt,
        dateOnly: fields.dateOnly,
        comment: fields.comment,
        ...teeColumns(parseTee(body.tee)),
        players: { create: fields.playerRows },
      },
    });
  });
  broadcastChange();
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireSimApi();
  if (error) return error;
  const { id } = await params;
  const result = await prisma.simPlay.deleteMany({ where: { id } });
  if (result.count === 0) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  }
  broadcastChange();
  return NextResponse.json({ ok: true });
}

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
import { parsePlayFields } from "./fields";

/**
 * Manual log entry for a past round. Unlike a wheel play, this does NOT take
 * the course off anyone's list (old-app behavior).
 */
export async function POST(req: Request) {
  const { viewer, error } = await requireSimApi();
  if (error) return error;
  const body = await req.json();

  const course = parseCourseInput(body.course);
  if (!course) {
    return NextResponse.json({ error: "Course name is required" }, { status: 400 });
  }
  const fields = parsePlayFields(body);
  if ("error" in fields) {
    return NextResponse.json({ error: fields.error }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    const c = await findOrCreateCourse(tx, course);
    await tx.simPlay.create({
      data: {
        courseId: c.id,
        playedAt: fields.playedAt,
        dateOnly: fields.dateOnly,
        source: "manual_entry",
        comment: fields.comment,
        loggedBy: viewer.id,
        ...teeColumns(parseTee(body.tee)),
        players: { create: fields.playerRows },
      },
    });
  });
  broadcastChange();
  return NextResponse.json({ ok: true }, { status: 201 });
}

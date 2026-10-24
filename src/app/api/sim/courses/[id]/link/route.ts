import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { broadcastChange } from "@/lib/events";
import { parseCourseInput, requireSimApi } from "@/lib/sim";

/**
 * Link a course to GolfCourseAPI: it takes the API's name + location. The
 * course is canonical, so every list row and play pointing at it is linked
 * at once. If another course already holds that apiId, the two merge.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireSimApi();
  if (error) return error;
  const { id } = await params;
  const input = parseCourseInput(await req.json());
  if (!input?.apiId) {
    return NextResponse.json({ error: "Pick a course from search" }, { status: 400 });
  }
  const apiId = input.apiId;

  const course = await prisma.simCourse.findUnique({ where: { id } });
  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  const target = await prisma.$transaction(async (tx) => {
    const holder = await tx.simCourse.findUnique({ where: { apiId } });
    if (!holder || holder.id === id) {
      return tx.simCourse.update({
        where: { id },
        data: {
          apiId,
          name: input.name,
          city: input.city ?? null,
          state: input.state ?? null,
          country: input.country ?? null,
        },
      });
    }
    // Merge `course` into `holder`.
    const entries = await tx.simListEntry.findMany({ where: { courseId: id } });
    for (const e of entries) {
      const clash = await tx.simListEntry.findUnique({
        where: { playerId_courseId: { playerId: e.playerId, courseId: holder.id } },
      });
      if (clash) {
        await tx.simListEntry.update({
          where: { id: clash.id },
          data: { tally: Math.max(clash.tally, e.tally) },
        });
        await tx.simListEntry.delete({ where: { id: e.id } });
      } else {
        await tx.simListEntry.update({
          where: { id: e.id },
          data: { courseId: holder.id },
        });
      }
    }
    await tx.simPlay.updateMany({ where: { courseId: id }, data: { courseId: holder.id } });
    await tx.simCourse.delete({ where: { id } });
    return holder;
  });

  broadcastChange();
  return NextResponse.json({ ok: true, courseId: target.id });
}

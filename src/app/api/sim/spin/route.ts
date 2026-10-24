import { NextResponse } from "next/server";
import { parseTee, requireSimApi } from "@/lib/sim";
import { resolveSpin } from "@/lib/sim-actions";

/**
 * Resolve a spin: `{ outcome: "play"|"skip", courseId, skippedCourseIds,
 * tee?, manual? }`. `manual` = Manual Play (admin pick instead of a spin).
 * Cancel never reaches the server — it has no side effects.
 */
export async function POST(req: Request) {
  const body = await req.json();
  const manual = body.manual === true;
  const { viewer, error } = await requireSimApi({ admin: manual });
  if (error) return error;

  if (body.outcome !== "play" && body.outcome !== "skip") {
    return NextResponse.json({ error: "Invalid outcome" }, { status: 400 });
  }
  if (typeof body.courseId !== "string" || !body.courseId) {
    return NextResponse.json({ error: "courseId required" }, { status: 400 });
  }
  const skipped = Array.isArray(body.skippedCourseIds)
    ? body.skippedCourseIds.filter((x: unknown): x is string => typeof x === "string")
    : [];

  try {
    const { playId } = await resolveSpin({
      outcome: body.outcome,
      courseId: body.courseId,
      skippedCourseIds: skipped,
      tee: parseTee(body.tee),
      source: manual ? "manual_play" : "wheel",
      loggedBy: viewer.id,
    });
    return NextResponse.json({ ok: true, playId });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't save that" },
      { status: 409 }
    );
  }
}

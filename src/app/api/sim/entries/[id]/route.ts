import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { broadcastChange } from "@/lib/events";
import { requireSimApi } from "@/lib/sim";

/** Manual tally nudge: body `{ delta: 1 | -1 }` (floors at 0). */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireSimApi();
  if (error) return error;
  const { id } = await params;
  const { delta } = await req.json();
  if (delta !== 1 && delta !== -1) {
    return NextResponse.json({ error: "delta must be 1 or -1" }, { status: 400 });
  }
  const entry = await prisma.simListEntry.findUnique({
    where: { id },
    select: { tally: true },
  });
  if (!entry) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }
  await prisma.simListEntry.update({
    where: { id },
    data: { tally: Math.max(0, entry.tally + delta) },
  });
  broadcastChange();
  return NextResponse.json({ ok: true });
}

/** Take a course off one player's list. */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireSimApi();
  if (error) return error;
  const { id } = await params;
  const result = await prisma.simListEntry.deleteMany({ where: { id } });
  if (result.count === 0) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }
  broadcastChange();
  return NextResponse.json({ ok: true });
}

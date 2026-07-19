import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin";
import { parseEventFields } from "@/lib/golf-events";
import { broadcastChange } from "@/lib/events";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json();
  const parsed = parseEventFields(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const result = await prisma.event.updateMany({ where: { id }, data: parsed });
  if (result.count === 0) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  broadcastChange();
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }
  const { id } = await params;

  // Rounds cascade away; their tee times survive as regular tee times
  // (eventRoundId → SetNull) and get swept by the normal cleanup once past.
  const result = await prisma.event.deleteMany({ where: { id } });
  if (result.count === 0) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  broadcastChange();
  return NextResponse.json({ ok: true });
}

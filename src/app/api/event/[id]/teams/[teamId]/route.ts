import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin";
import { broadcastChange } from "@/lib/events";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; teamId: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }
  const { id, teamId } = await params;
  const body = await req.json();

  const data: { name?: string; color?: string | null } = {};
  if ("name" in body) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "Team name is required" }, { status: 400 });
    }
    data.name = name;
  }
  if ("color" in body) {
    data.color =
      typeof body.color === "string" && body.color.trim()
        ? body.color.trim()
        : null;
  }

  const result = await prisma.eventTeam.updateMany({
    where: { id: teamId, eventId: id },
    data,
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  broadcastChange();
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; teamId: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }
  const { id, teamId } = await params;

  // Participants' teamId and round overrides fall back to null (SetNull);
  // scores for this team cascade away with it.
  const result = await prisma.eventTeam.deleteMany({
    where: { id: teamId, eventId: id },
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  broadcastChange();
  return NextResponse.json({ ok: true });
}

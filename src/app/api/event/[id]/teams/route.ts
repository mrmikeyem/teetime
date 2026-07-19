import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin";
import { broadcastChange } from "@/lib/events";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json();

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Team name is required" }, { status: 400 });
  }
  const color =
    typeof body.color === "string" && body.color.trim()
      ? body.color.trim()
      : null;

  const event = await prisma.event.findUnique({
    where: { id },
    select: { id: true, teams: { select: { seq: true } } },
  });
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const seq = event.teams.reduce((max, t) => Math.max(max, t.seq), 0) + 1;

  try {
    const team = await prisma.eventTeam.create({
      data: { eventId: id, name, color, seq },
      select: { id: true },
    });
    broadcastChange();
    return NextResponse.json({ id: team.id }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "A team with that name already exists" },
      { status: 409 }
    );
  }
}

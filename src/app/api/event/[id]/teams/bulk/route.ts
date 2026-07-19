import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin";
import { broadcastChange } from "@/lib/events";

type BulkTeam = { name: string; userIds: string[] };

/**
 * Save a team-generator draw into an event: replaces the event's teams and
 * every participant's default-team assignment in one transaction. Players
 * without an account (ad-hoc generator guests) can't be saved — the client
 * warns before calling. Body: { teams: [{ name, userIds }] }
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json();

  const raw: unknown[] = Array.isArray(body.teams) ? body.teams : [];
  const teams: BulkTeam[] = raw
    .map((t) => {
      const o = t as Record<string, unknown>;
      return {
        name: typeof o.name === "string" ? o.name.trim() : "",
        userIds: Array.isArray(o.userIds)
          ? o.userIds.filter((u): u is string => typeof u === "string")
          : [],
      };
    })
    .filter((t) => t.name);
  if (teams.length < 2) {
    return NextResponse.json(
      { error: "At least two named teams are required" },
      { status: 400 }
    );
  }

  const event = await prisma.event.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    // Replace teams wholesale — old scores/overrides cascade with them.
    await tx.eventTeam.deleteMany({ where: { eventId: id } });
    for (let i = 0; i < teams.length; i++) {
      const team = await tx.eventTeam.create({
        data: { eventId: id, name: teams[i].name, seq: i + 1 },
        select: { id: true },
      });
      for (const userId of teams[i].userIds) {
        await tx.eventParticipant.upsert({
          where: { eventId_userId: { eventId: id, userId } },
          create: { eventId: id, userId, teamId: team.id },
          update: { teamId: team.id },
        });
      }
    }
  });

  broadcastChange();
  return NextResponse.json({ ok: true }, { status: 201 });
}

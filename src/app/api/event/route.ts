import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin";
import { parseEventFields } from "@/lib/golf-events";
import { broadcastChange } from "@/lib/events";

// Events-module REST API. Lives under /api/event (singular) because
// /api/events is the pre-existing SSE stream.

export async function POST(req: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = parseEventFields(body);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const event = await prisma.event.create({
    data: { ...parsed, createdBy: session.user.id },
    select: { id: true },
  });

  broadcastChange();
  return NextResponse.json({ id: event.id }, { status: 201 });
}

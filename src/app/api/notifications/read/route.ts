import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Mark the current user's unread notifications as read. Called when the bell
 * panel is opened ("read on open"). Idempotent — marking already-read rows is
 * a no-op. Optionally scope to a set of ids (the ones currently shown) so a
 * notification that arrived after the panel rendered isn't silently cleared.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let ids: string[] | undefined;
  try {
    const body = await req.json();
    if (Array.isArray(body?.ids)) {
      ids = body.ids.filter((x: unknown): x is string => typeof x === "string");
    }
  } catch {
    // No/!invalid body → mark all unread read.
  }

  const now = new Date();
  const { count } = await prisma.notification.updateMany({
    where: {
      userId: session.user.id,
      readAt: null,
      dismissedAt: null,
      ...(ids ? { id: { in: ids } } : {}),
    },
    data: { readAt: now },
  });

  return NextResponse.json({ marked: count });
}

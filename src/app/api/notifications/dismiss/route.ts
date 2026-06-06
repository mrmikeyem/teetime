import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Soft-dismiss notifications (the per-item ✕). Pass { id } for one or
 * { ids: [...] } for several. Scoped to the session user so you can't dismiss
 * someone else's. Idempotent. Dismissed rows fall out of the feed query and
 * are swept by the hourly prune.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let ids: string[] = [];
  try {
    const body = await req.json();
    if (typeof body?.id === "string") ids = [body.id];
    else if (Array.isArray(body?.ids)) {
      ids = body.ids.filter((x: unknown): x is string => typeof x === "string");
    }
  } catch {
    // fall through to empty
  }

  if (ids.length === 0) {
    return NextResponse.json({ error: "id or ids required" }, { status: 400 });
  }

  const { count } = await prisma.notification.updateMany({
    where: { id: { in: ids }, userId: session.user.id, dismissedAt: null },
    data: { dismissedAt: new Date() },
  });

  return NextResponse.json({ dismissed: count });
}

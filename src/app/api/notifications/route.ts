import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getResolvedFeed } from "@/lib/notification-feed";

/**
 * The current user's notification feed (excluding dismissed), each item
 * enriched with its live actionState. Used by the bell's "See all" refetch
 * and the /notifications page client refresh.
 */
export async function GET(req: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const takeParam = Number(url.searchParams.get("take"));
  const take =
    Number.isFinite(takeParam) && takeParam > 0
      ? Math.min(takeParam, 50)
      : 20;

  const { items, unread } = await getResolvedFeed(session.user.id, take);
  return NextResponse.json({ items, unread });
}

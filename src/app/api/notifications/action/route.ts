import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  confirmMembership,
  declineOrLeaveMembership,
  joinTeeTime,
} from "@/lib/tee-time-actions";
import { getResolvedFeed, type ActionState } from "@/lib/notification-feed";

type InlineAction = "confirm" | "decline" | "join" | "leave";

const VALID: ReadonlySet<string> = new Set([
  "confirm",
  "decline",
  "join",
  "leave",
]);

/**
 * Which live actionState each inline action requires.
 *  - decline: backing out BEFORE confirming (item still 'confirmable')
 *  - leave:   backing out AFTER confirming (item is 'confirmed')
 * Both route to the same removal core; the split just mirrors the two UI
 * affordances and the live state each is valid from.
 */
const REQUIRED_STATE: Record<InlineAction, ActionState> = {
  confirm: "confirmable",
  decline: "confirmable",
  join: "joinable",
  leave: "confirmed",
};

/**
 * Session-authed inline feed actions (Confirm / Decline / Join / Leave). Validates the
 * notification belongs to the user, re-resolves the live actionState to reject
 * stale taps, then calls the shared mutation core (same path as the email
 * links — broadcastChange + notify* included). Returns the refreshed item.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  let action: string | undefined;
  let notificationId: string | undefined;
  try {
    const body = await req.json();
    action = body?.action;
    notificationId = body?.notificationId;
  } catch {
    // fall through
  }

  if (!action || !VALID.has(action) || typeof notificationId !== "string") {
    return NextResponse.json(
      { error: "action (confirm|decline|join) and notificationId required" },
      { status: 400 }
    );
  }
  const act = action as InlineAction;

  // Ownership + current state in one shot via the resolver.
  const { items } = await getResolvedFeed(userId, 50);
  const item = items.find((i) => i.id === notificationId);
  if (!item) {
    return NextResponse.json(
      { error: "Notification not found." },
      { status: 404 }
    );
  }
  if (!item.teeTimeId) {
    return NextResponse.json(
      { error: "This notification has no tee time." },
      { status: 400 }
    );
  }
  if (item.actionState !== REQUIRED_STATE[act]) {
    // Stale tap (filled, past, already acted). Hand back the fresh state so
    // the client re-renders the correct disabled label.
    return NextResponse.json(
      { error: "This action is no longer available.", item },
      { status: 409 }
    );
  }

  try {
    if (act === "confirm") await confirmMembership(userId, item.teeTimeId);
    else if (act === "decline" || act === "leave")
      await declineOrLeaveMembership(userId, item.teeTimeId);
    else await joinTeeTime(userId, item.teeTimeId);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Something went wrong.";
    return NextResponse.json({ error: message }, { status: 409 });
  }

  // Mark the acted item read, and return its refreshed state.
  await prisma.notification.updateMany({
    where: { id: notificationId, userId, readAt: null },
    data: { readAt: new Date() },
  });

  const refreshed = await getResolvedFeed(userId, 50);
  const updated =
    refreshed.items.find((i) => i.id === notificationId) ?? null;

  return NextResponse.json({ ok: true, item: updated, unread: refreshed.unread });
}

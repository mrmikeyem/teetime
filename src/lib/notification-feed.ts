import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * In-app notification feed (the bell on /tee-times).
 *
 * This is the "in case you missed it" channel: a persistent record of the
 * same nudges sent over email + web push. UNLIKE email/push, it is written
 * REGARDLESS of the user's notification preferences (including
 * unsubscribedAll) — muting email/push silences those channels, not the
 * in-app feed. So always call this alongside the email/push send, NOT gated
 * behind shouldNotify()/filterEligibleUsers().
 */
export type FeedType =
  | "addedTo"
  | "joined"
  | "left"
  | "newTeeTime"
  | "reminder"
  | "announcement";

/**
 * Record one in-app notification for one user. Fire-and-forget from the
 * notify* fan-outs: errors are logged, never thrown, so a feed-write failure
 * can't break the email/push send it travels with.
 */
export async function recordNotification(opts: {
  userId: string;
  type: FeedType;
  title: string;
  body: string;
  url: string;
}): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId: opts.userId,
        type: opts.type,
        title: opts.title,
        body: opts.body,
        url: opts.url,
      },
    });
  } catch (err) {
    console.error("[recordNotification] failed:", err);
  }
}

/**
 * Like recordNotification, but a no-op if an UNDISMISSED feed row of the same
 * (userId, type, url) already exists. Used by the reminder cron, whose
 * remindedAt dedupe protects the EMAIL but not the feed: a transient send
 * failure (remindedAt left unset → email retried next tick) or a tee-time
 * time-edit (clears remindedAt by design to re-fire the email) would otherwise
 * stack duplicate "in 1 hour" bell items. Keying on type+url makes the feed
 * write idempotent without disturbing the email-retry semantics.
 */
export async function recordNotificationOnce(opts: {
  userId: string;
  type: FeedType;
  title: string;
  body: string;
  url: string;
}): Promise<void> {
  try {
    const existing = await prisma.notification.findFirst({
      where: {
        userId: opts.userId,
        type: opts.type,
        url: opts.url,
        dismissedAt: null,
      },
      select: { id: true },
    });
    if (existing) return;
    await prisma.notification.create({
      data: {
        userId: opts.userId,
        type: opts.type,
        title: opts.title,
        body: opts.body,
        url: opts.url,
      },
    });
  } catch (err) {
    console.error("[recordNotificationOnce] failed:", err);
  }
}

/**
 * The action a feed item currently offers, resolved against LIVE tee-time
 * state (so the bell never shows a dead button):
 *  - confirmable: you're on it, not yet confirmed → Confirm / Decline
 *  - confirmed:   you're on it and confirmed (informational)
 *  - joinable:    open tee time you're not on → Join
 *  - full:        no spots left
 *  - already_on:  a "new tee time" you've since joined
 *  - past:        tee-off already passed
 *  - gone:        tee time was deleted
 *  - none:        informational only (someone joined/left)
 */
export type ActionState =
  | "confirmable"
  | "confirmed"
  | "joinable"
  | "full"
  | "already_on"
  | "past"
  | "gone"
  | "none";

export type ResolvedFeedItem = {
  id: string;
  type: string;
  title: string;
  body: string;
  url: string;
  read: boolean;
  createdAt: string; // ISO
  teeTimeId: string | null;
  actionState: ActionState;
};

/** Pull the tee-time id out of a "/tee-times/<id>" url, else null. */
function teeTimeIdFromUrl(url: string): string | null {
  const m = url.match(/^\/tee-times\/([0-9a-fA-F-]{36})/);
  return m ? m[1] : null;
}

/**
 * Load a user's feed (excluding dismissed) and enrich each item with its live
 * actionState. Used by GET /api/notifications, the bell, and /notifications.
 */
export async function getResolvedFeed(
  userId: string,
  take = 20
): Promise<{ items: ResolvedFeedItem[]; unread: number }> {
  const [rows, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId, dismissedAt: null },
      orderBy: { createdAt: "desc" },
      take,
    }),
    prisma.notification.count({
      where: { userId, dismissedAt: null, readAt: null },
    }),
  ]);

  // Batch-load the referenced tee times + this user's membership in one query.
  const teeTimeIds = Array.from(
    new Set(
      rows.map((r) => teeTimeIdFromUrl(r.url)).filter((x): x is string => !!x)
    )
  );

  const teeTimes = teeTimeIds.length
    ? await prisma.teeTime.findMany({
        where: { id: { in: teeTimeIds } },
        select: {
          id: true,
          partySize: true,
          teeOffAt: true,
          _count: { select: { members: true } },
          members: {
            where: { userId },
            select: { confirmed: true },
          },
        },
      })
    : [];
  const byId = new Map(teeTimes.map((t) => [t.id, t]));

  const items: ResolvedFeedItem[] = rows.map((r) => {
    const teeTimeId = teeTimeIdFromUrl(r.url);
    return {
      id: r.id,
      type: r.type,
      title: r.title,
      body: r.body,
      url: r.url,
      read: r.readAt != null,
      createdAt: r.createdAt.toISOString(),
      teeTimeId,
      actionState: resolveActionState(r.type, teeTimeId, byId),
    };
  });

  return { items, unread };
}

type TeeTimeLite = {
  partySize: number | null;
  teeOffAt: Date;
  _count: { members: number };
  members: { confirmed: boolean }[];
};

function resolveActionState(
  type: string,
  teeTimeId: string | null,
  byId: Map<string, TeeTimeLite>
): ActionState {
  // Informational types never carry an action.
  if (type === "joined" || type === "left" || type === "announcement")
    return "none";
  if (!teeTimeId) return "none";

  const tt = byId.get(teeTimeId);
  if (!tt) return "gone";
  if (tt.teeOffAt.getTime() < Date.now()) return "past";

  const membership = tt.members[0];
  const isMember = membership != null;

  if (type === "newTeeTime") {
    if (isMember) return "already_on";
    // partySize null = tournament = unlimited, always joinable.
    if (tt.partySize != null && tt._count.members >= tt.partySize) {
      return "full";
    }
    return "joinable";
  }

  // addedTo / reminder → confirm flow.
  if (!isMember) return "gone"; // you're no longer on it; nothing to confirm
  return membership.confirmed ? "confirmed" : "confirmable";
}

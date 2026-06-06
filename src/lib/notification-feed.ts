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
  | "reminder";

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

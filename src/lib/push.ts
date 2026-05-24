import "server-only";
import webpush from "web-push";
import { prisma } from "./prisma";

let configured = false;
function ensureConfigured() {
  if (configured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<{ delivered: number; pruned: number }> {
  if (!ensureConfigured()) return { delivered: 0, pruned: 0 };

  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subs.length === 0) return { delivered: 0, pruned: 0 };

  let delivered = 0;
  const expiredIds: string[] = [];
  const json = JSON.stringify(payload);

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          json,
          { TTL: 60 * 60 }
        );
        delivered++;
        // Update lastSeenAt lazily — only on successful delivery.
        await prisma.pushSubscription
          .update({ where: { id: s.id }, data: { lastSeenAt: new Date() } })
          .catch(() => {});
      } catch (err: unknown) {
        const status =
          err && typeof err === "object" && "statusCode" in err
            ? (err as { statusCode: number }).statusCode
            : 0;
        // 404/410 = subscription is dead. Prune it.
        if (status === 404 || status === 410) {
          expiredIds.push(s.id);
        } else {
          console.error(`[push] send failed for ${s.id}:`, err);
        }
      }
    })
  );

  if (expiredIds.length > 0) {
    await prisma.pushSubscription
      .deleteMany({ where: { id: { in: expiredIds } } })
      .catch(() => {});
  }

  return { delivered, pruned: expiredIds.length };
}

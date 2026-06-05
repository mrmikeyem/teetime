import "server-only";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mailer";
import {
  addedToTeeTimeEmail,
  joinedTeeTimeEmail,
  leftTeeTimeEmail,
  newTeeTimeAvailableEmail,
  type RosterEntry,
} from "@/lib/email-templates";
import { shouldNotify, filterEligibleUsers } from "@/lib/notifications";
import { mintToken, buildActionUrl } from "@/lib/email-actions";
import { sendPushToUser } from "@/lib/push";

const APP_URL = process.env.AUTH_URL ?? "https://tee3golf.com";

const INVITE_ACTION_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14d (or until tee time, whichever earlier)
const UNSUBSCRIBE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Log any rejected sends from a fan-out. Promise.allSettled never rejects,
 * so without this a failed recipient send disappears without a trace —
 * which is how the 2026-06-04 rate-limited broadcast went unnoticed.
 */
function logFanOutFailures(
  context: string,
  recipients: { email: string | null }[],
  results: PromiseSettledResult<unknown>[]
) {
  results.forEach((r, i) => {
    if (r.status === "rejected") {
      console.error(
        `[${context}] send to ${recipients[i]?.email ?? "(unknown)"} failed:`,
        r.reason
      );
    }
  });
}

/**
 * Send a "you were added to a tee time" email to a single user.
 * Fire-and-forget from API routes. Errors are logged, not thrown.
 */
export async function notifyAddedToTeeTime(opts: {
  userId: string;
  teeTimeId: string;
  addedByUserId: string;
}) {
  try {
    const { userId, teeTimeId, addedByUserId } = opts;
    if (userId === addedByUserId) return; // don't email someone for adding themselves

    const eligible = await shouldNotify(userId, "addedTo");
    if (!eligible) return;

    const [user, teeTime, adder] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true },
      }),
      prisma.teeTime.findUnique({
        where: { id: teeTimeId },
        include: {
          members: {
            include: {
              user: { select: { name: true } },
              guest: { select: { name: true } },
            },
            orderBy: { createdAt: "asc" },
          },
        },
      }),
      prisma.user.findUnique({
        where: { id: addedByUserId },
        select: { name: true },
      }),
    ]);

    if (!user?.email || !teeTime || !adder) return;

    const roster: RosterEntry[] = teeTime.members.map((m) => ({
      name: m.user?.name ?? m.guest?.name ?? "(unknown)",
      confirmed: m.confirmed,
      isGuest: !!m.guestId,
    }));

    // Action TTL is min(14d, time-until-tee-off + 1h)
    const ttlMs = Math.min(
      INVITE_ACTION_TTL_MS,
      teeTime.teeOffAt.getTime() + 60 * 60 * 1000 - Date.now()
    );
    if (ttlMs <= 0) return; // tee time already past

    const [confirm, decline, unsubscribe] = await Promise.all([
      mintToken({ userId, action: "confirm", teeTimeId, ttlMs }),
      mintToken({ userId, action: "decline", teeTimeId, ttlMs }),
      mintToken({ userId, action: "unsubscribe", ttlMs: UNSUBSCRIBE_TTL_MS }),
    ]);

    const { subject, text, html } = addedToTeeTimeEmail({
      recipientName: user.name,
      addedByName: adder.name,
      course: teeTime.course,
      teeOffAt: teeTime.teeOffAt,
      roster,
      confirmUrl: buildActionUrl(confirm.rawToken, "confirm"),
      declineUrl: buildActionUrl(decline.rawToken, "decline"),
      detailUrl: `${APP_URL}/tee-times/${teeTime.id}`,
      unsubscribeUrl: buildActionUrl(unsubscribe.rawToken, "unsubscribe"),
    });

    await sendMail({ to: user.email, subject, text, html, kind: "added-to-tee-time" });

    sendPushToUser(userId, {
      title: `${adder.name} added you to a tee time`,
      body: `${teeTime.course}`,
      url: `/tee-times/${teeTime.id}`,
      tag: `added-${teeTime.id}`,
    }).catch((err) => console.error("[push] addedTo failed:", err));
  } catch (err) {
    console.error("[notifyAddedToTeeTime] failed:", err);
  }
}

/**
 * Notify other registered members when someone NEW joins a tee time.
 * Skip the joiner and the actor. Respects joinedByOther pref.
 */
export async function notifyMemberJoined(opts: {
  teeTimeId: string;
  joinerUserId: string;
  actorUserId: string;
}) {
  try {
    const { teeTimeId, joinerUserId, actorUserId } = opts;

    const teeTime = await prisma.teeTime.findUnique({
      where: { id: teeTimeId },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });
    if (!teeTime) return;

    if (teeTime.teeOffAt.getTime() < Date.now()) return; // past tee time, skip

    const joiner = teeTime.members.find((m) => m.userId === joinerUserId)?.user;
    if (!joiner) return;

    const otherMemberUserIds = teeTime.members
      .map((m) => m.userId)
      .filter((id): id is string => !!id)
      .filter((id) => id !== joinerUserId && id !== actorUserId);

    if (otherMemberUserIds.length === 0) return;

    const eligibleIds = await filterEligibleUsers(otherMemberUserIds, "joinedByOther");
    if (eligibleIds.length === 0) return;

    const recipients = await prisma.user.findMany({
      where: { id: { in: eligibleIds }, email: { not: null } },
      select: { id: true, name: true, email: true },
    });

    const results = await Promise.allSettled(
      recipients.map(async (r) => {
        const unsubscribe = await mintToken({
          userId: r.id,
          action: "unsubscribe",
          ttlMs: UNSUBSCRIBE_TTL_MS,
        });
        const { subject, text, html } = joinedTeeTimeEmail({
          recipientName: r.name,
          joinerName: joiner.name,
          course: teeTime.course,
          teeOffAt: teeTime.teeOffAt,
          detailUrl: `${APP_URL}/tee-times/${teeTime.id}`,
          unsubscribeUrl: buildActionUrl(unsubscribe.rawToken, "unsubscribe"),
        });
        await sendMail({ to: r.email!, subject, text, html, kind: "member-joined" });
        sendPushToUser(r.id, {
          title: `${joiner.name} joined your tee time`,
          body: teeTime.course,
          url: `/tee-times/${teeTime.id}`,
          tag: `joined-${teeTime.id}-${joinerUserId}`,
        }).catch((err) => console.error("[push] memberJoined failed:", err));
      })
    );
    logFanOutFailures("notifyMemberJoined", recipients, results);
  } catch (err) {
    console.error("[notifyMemberJoined] failed:", err);
  }
}

/**
 * Notify other registered members when someone leaves a tee time.
 * Skip the leaver and the actor. Respects leftByOther pref.
 */
export async function notifyMemberLeft(opts: {
  teeTimeId: string;
  leaverName: string;
  actorUserId: string | null;
  remainingMemberUserIds: string[];
  course: string;
  teeOffAt: Date;
}) {
  try {
    const { teeTimeId, leaverName, actorUserId, remainingMemberUserIds, course, teeOffAt } = opts;

    if (teeOffAt.getTime() < Date.now()) return;

    const targetUserIds = remainingMemberUserIds.filter((id) => id !== actorUserId);
    if (targetUserIds.length === 0) return;

    const eligibleIds = await filterEligibleUsers(targetUserIds, "leftByOther");
    if (eligibleIds.length === 0) return;

    const recipients = await prisma.user.findMany({
      where: { id: { in: eligibleIds }, email: { not: null } },
      select: { id: true, name: true, email: true },
    });

    const results = await Promise.allSettled(
      recipients.map(async (r) => {
        const unsubscribe = await mintToken({
          userId: r.id,
          action: "unsubscribe",
          ttlMs: UNSUBSCRIBE_TTL_MS,
        });
        const { subject, text, html } = leftTeeTimeEmail({
          recipientName: r.name,
          leaverName,
          course,
          teeOffAt,
          detailUrl: `${APP_URL}/tee-times/${teeTimeId}`,
          unsubscribeUrl: buildActionUrl(unsubscribe.rawToken, "unsubscribe"),
        });
        await sendMail({ to: r.email!, subject, text, html, kind: "member-left" });
        sendPushToUser(r.id, {
          title: `${leaverName} left your tee time`,
          body: course,
          url: `/tee-times/${teeTimeId}`,
          tag: `left-${teeTimeId}-${leaverName}`,
        }).catch((err) => console.error("[push] memberLeft failed:", err));
      })
    );
    logFanOutFailures("notifyMemberLeft", recipients, results);
  } catch (err) {
    console.error("[notifyMemberLeft] failed:", err);
  }
}

/**
 * Broadcast a newly-created tee time to every registered user not on it,
 * provided the tee time has open spots. Respects newTeeTime pref.
 */
export async function notifyNewTeeTime(opts: {
  teeTimeId: string;
  bookerUserId: string;
}) {
  try {
    const { teeTimeId, bookerUserId } = opts;

    const teeTime = await prisma.teeTime.findUnique({
      where: { id: teeTimeId },
      include: {
        creator: { select: { id: true, name: true } },
        members: { select: { userId: true } },
      },
    });
    if (!teeTime) return;
    if (teeTime.teeOffAt.getTime() < Date.now()) return;

    // Skip broadcast for tournaments — they have unlimited capacity and
    // would spam everyone on every new tournament. Tournament discovery
    // happens via the calendar/list, not email.
    if (teeTime.partySize == null) return;

    const openSpots = teeTime.partySize - teeTime.members.length;
    if (openSpots <= 0) return;

    const memberUserIds = new Set(
      teeTime.members.map((m) => m.userId).filter((id): id is string => !!id)
    );

    const candidates = await prisma.user.findMany({
      where: {
        id: { notIn: Array.from(memberUserIds), not: bookerUserId },
        email: { not: null },
      },
      select: { id: true, name: true, email: true },
    });
    if (candidates.length === 0) return;

    const eligibleIds = await filterEligibleUsers(
      candidates.map((c) => c.id),
      "newTeeTime"
    );
    if (eligibleIds.length === 0) return;

    const eligibleSet = new Set(eligibleIds);
    const recipients = candidates.filter((c) => eligibleSet.has(c.id));

    // Token TTL: until 1h after tee-off, capped at 14 days.
    const ttlMs = Math.min(
      14 * 24 * 60 * 60 * 1000,
      teeTime.teeOffAt.getTime() + 60 * 60 * 1000 - Date.now()
    );
    if (ttlMs <= 0) return;

    const results = await Promise.allSettled(
      recipients.map(async (r) => {
        const [join, unsubscribe] = await Promise.all([
          mintToken({ userId: r.id, action: "join", teeTimeId, ttlMs }),
          mintToken({
            userId: r.id,
            action: "unsubscribe",
            ttlMs: UNSUBSCRIBE_TTL_MS,
          }),
        ]);
        const { subject, text, html } = newTeeTimeAvailableEmail({
          recipientName: r.name,
          bookerName: teeTime.creator.name,
          course: teeTime.course,
          teeOffAt: teeTime.teeOffAt,
          openSpots,
          joinUrl: buildActionUrl(join.rawToken, "join"),
          detailUrl: `${APP_URL}/tee-times/${teeTimeId}`,
          unsubscribeUrl: buildActionUrl(unsubscribe.rawToken, "unsubscribe"),
        });
        await sendMail({ to: r.email!, subject, text, html, kind: "new-tee-time" });
        sendPushToUser(r.id, {
          title: `New tee time at ${teeTime.course}`,
          body: `${teeTime.creator.name} booked it — ${
            openSpots === 1 ? "1 open spot" : openSpots + " open spots"
          }`,
          url: `/tee-times/${teeTimeId}`,
          tag: `new-${teeTimeId}`,
        }).catch((err) => console.error("[push] newTeeTime failed:", err));
      })
    );
    logFanOutFailures("notifyNewTeeTime", recipients, results);
  } catch (err) {
    console.error("[notifyNewTeeTime] failed:", err);
  }
}

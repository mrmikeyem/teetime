import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mailer";
import { reminderEmail, type RosterEntry } from "@/lib/email-templates";
import { shouldNotify } from "@/lib/notifications";
import { mintToken, buildActionUrl } from "@/lib/email-actions";
import { startOfTodayInAppTz } from "@/lib/time";
import { getRoundSummary } from "@/lib/weather-summary";
import { sendPushToUser } from "@/lib/push";
import { recordNotification } from "@/lib/notification-feed";

const REMIND_BEFORE_MIN = 60;
const WINDOW_MIN = 5;

const ACTION_TTL_MS = 3 * 60 * 60 * 1000; // 3h covers reminder window + tee time
const UNSUBSCRIBE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30d

const APP_URL = process.env.AUTH_URL ?? "https://tee3golf.com";

export async function POST(req: Request) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const windowStart = new Date(now.getTime() + (REMIND_BEFORE_MIN - WINDOW_MIN) * 60 * 1000);
  const windowEnd = new Date(now.getTime() + (REMIND_BEFORE_MIN + WINDOW_MIN) * 60 * 1000);

  const teeTimes = await prisma.teeTime.findMany({
    where: { teeOffAt: { gte: windowStart, lte: windowEnd } },
    include: {
      members: {
        include: {
          user: { select: { id: true, name: true, email: true } },
          guest: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  let sent = 0;
  let skippedPrefs = 0;
  let failed = 0;
  const errors: Array<{ memberId: string; error: string }> = [];

  for (const t of teeTimes) {
    const roster: RosterEntry[] = t.members.map((m) => ({
      name: m.user?.name ?? m.guest?.name ?? "(unknown)",
      confirmed: m.confirmed,
      isGuest: !!m.guestId,
    }));

    const whatToExpect =
      t.lat != null && t.lon != null
        ? await getRoundSummary({ lat: t.lat, lon: t.lon }, t.teeOffAt)
            .then((r) => r?.summary ?? null)
            .catch(() => null)
        : null;

    for (const m of t.members) {
      if (!m.userId || m.remindedAt) continue;

      try {
        // In-app feed records once per member (deduped by remindedAt below),
        // regardless of prefs or whether they have an email.
        await recordNotification({
          userId: m.userId,
          type: "reminder",
          title:
            t.type === "TOURNAMENT"
              ? `${t.isShotgun ? "Shotgun" : "Tournament"} in 1 hour`
              : "Tee time in 1 hour",
          body: `${t.name ? t.name + " · " : ""}${t.course}`,
          url: `/tee-times/${t.id}`,
        });

        const eligible = await shouldNotify(m.userId, "reminder");
        if (!eligible || !m.user?.email) {
          skippedPrefs++;
          await prisma.teeTimeMember.update({
            where: { id: m.id },
            data: { remindedAt: now },
          });
          continue;
        }

        const [confirm, leave, unsubscribe] = await Promise.all([
          mintToken({ userId: m.userId, action: "confirm", teeTimeId: t.id, ttlMs: ACTION_TTL_MS }),
          mintToken({ userId: m.userId, action: "leave", teeTimeId: t.id, ttlMs: ACTION_TTL_MS }),
          mintToken({ userId: m.userId, action: "unsubscribe", ttlMs: UNSUBSCRIBE_TTL_MS }),
        ]);

        const { subject, text, html } = reminderEmail({
          name: m.user.name,
          course: t.course,
          tournamentName: t.name,
          teeOffAt: t.teeOffAt,
          roster,
          confirmUrl: buildActionUrl(confirm.rawToken, "confirm"),
          leaveUrl: buildActionUrl(leave.rawToken, "leave"),
          detailUrl: `${APP_URL}/tee-times/${t.id}`,
          unsubscribeUrl: buildActionUrl(unsubscribe.rawToken, "unsubscribe"),
          whatToExpect,
          isTournament: t.type === "TOURNAMENT",
          isShotgun: t.isShotgun,
        });

        await sendMail({ to: m.user.email, subject, text, html, kind: "reminder" });

        // Fire push to any subscribed devices for this user. Failure here
        // shouldn't kill the email send — fire-and-forget with a logged error.
        sendPushToUser(m.userId, {
          title: t.type === "TOURNAMENT"
            ? `${t.isShotgun ? "Shotgun" : "Tournament"} in 1 hour`
            : "Tee time in 1 hour",
          body: `${t.name ? t.name + " · " : ""}${t.course}`,
          url: `/tee-times/${t.id}`,
          tag: `reminder-${t.id}`,
        }).catch((err) => console.error("[push] reminder failed:", err));

        await prisma.teeTimeMember.update({
          where: { id: m.id },
          data: { remindedAt: now },
        });

        sent++;
      } catch (err) {
        failed++;
        errors.push({
          memberId: m.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  const url = new URL(req.url);
  const forceCleanup = url.searchParams.get("force") === "cleanup";
  const cleanup =
    forceCleanup || now.getUTCMinutes() < WINDOW_MIN
      ? await runCleanup(now)
      : null;

  return NextResponse.json({
    now: now.toISOString(),
    teeTimesChecked: teeTimes.length,
    sent,
    skippedPrefs,
    failed,
    errors,
    cleanup,
  });
}

/**
 * Hourly housekeeping. Runs once per hour (during the first tick after :00).
 * Deletes tee times whose tee-off day has passed in America/Chicago, orphaned
 * guests, expired email-action tokens, and used password-reset tokens.
 */
const NOTIFICATION_READ_TTL_MS = 30 * 24 * 60 * 60 * 1000; // prune read items after 30d
const NOTIFICATION_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000; // backstop: any item after 90d

async function runCleanup(now: Date) {
  const cutoff = startOfTodayInAppTz(now);
  const readNotifCutoff = new Date(now.getTime() - NOTIFICATION_READ_TTL_MS);
  const maxNotifCutoff = new Date(now.getTime() - NOTIFICATION_MAX_AGE_MS);

  const [teeTimes, tokens, resetTokens, notifications] = await Promise.all([
    prisma.teeTime.deleteMany({ where: { teeOffAt: { lt: cutoff } } }),
    prisma.emailActionToken.deleteMany({ where: { expiresAt: { lt: now } } }),
    prisma.passwordResetToken.deleteMany({
      where: { OR: [{ usedAt: { not: null } }, { expiresAt: { lt: now } }] },
    }),
    // Read notifications older than 30d, plus anything older than 90d
    // (backstop so an unopened bell can't grow without bound).
    prisma.notification.deleteMany({
      where: {
        OR: [
          { readAt: { not: null }, createdAt: { lt: readNotifCutoff } },
          { createdAt: { lt: maxNotifCutoff } },
        ],
      },
    }),
  ]);

  // Orphaned guests = guests with no remaining tee_time_members rows.
  // The TeeTimeMember rows for the deleted tee times were cascade-deleted above.
  const orphans = await prisma.guest.deleteMany({
    where: { teeTimeMembers: { none: {} } },
  });

  return {
    teeTimesDeleted: teeTimes.count,
    orphanGuestsDeleted: orphans.count,
    actionTokensDeleted: tokens.count,
    resetTokensDeleted: resetTokens.count,
    notificationsDeleted: notifications.count,
    cutoff: cutoff.toISOString(),
  };
}

function authorize(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const provided = req.headers.get("x-cron-secret") ?? "";
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

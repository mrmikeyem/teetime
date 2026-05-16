import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mailer";
import { reminderEmail, type RosterEntry } from "@/lib/email-templates";
import { shouldNotify } from "@/lib/notifications";
import { mintToken, buildActionUrl } from "@/lib/email-actions";

const REMIND_BEFORE_MIN = 60;
const WINDOW_MIN = 5;

const ACTION_TTL_MS = 3 * 60 * 60 * 1000; // 3h covers reminder window + tee time
const UNSUBSCRIBE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30d

const APP_URL = process.env.AUTH_URL ?? "https://infiniterien.com";

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

    for (const m of t.members) {
      if (!m.userId || !m.user?.email || m.remindedAt) continue;

      try {
        const eligible = await shouldNotify(m.userId, "reminder");
        if (!eligible) {
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
          teeOffAt: t.teeOffAt,
          roster,
          confirmUrl: buildActionUrl(confirm.rawToken, "confirm"),
          leaveUrl: buildActionUrl(leave.rawToken, "leave"),
          detailUrl: `${APP_URL}/tee-times/${t.id}`,
          unsubscribeUrl: buildActionUrl(unsubscribe.rawToken, "unsubscribe"),
        });

        await sendMail({ to: m.user.email, subject, text, html });

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
async function runCleanup(now: Date) {
  const cutoff = startOfTodayInCT(now);

  const [teeTimes, tokens, resetTokens] = await Promise.all([
    prisma.teeTime.deleteMany({ where: { teeOffAt: { lt: cutoff } } }),
    prisma.emailActionToken.deleteMany({ where: { expiresAt: { lt: now } } }),
    prisma.passwordResetToken.deleteMany({
      where: { OR: [{ usedAt: { not: null } }, { expiresAt: { lt: now } }] },
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
    cutoff: cutoff.toISOString(),
  };
}

/**
 * Returns the UTC instant equal to midnight America/Chicago of the current day.
 * Tee times with teeOffAt < this instant are "yesterday or earlier" in CT.
 */
function startOfTodayInCT(now: Date): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
  const ctY = Number(get("year"));
  const ctM = Number(get("month"));
  const ctD = Number(get("day"));
  const ctH = Number(get("hour"));
  const ctMin = Number(get("minute"));
  const ctS = Number(get("second"));
  // Offset between CT wall clock and UTC at this moment (handles DST automatically).
  const ctAsIfUtc = Date.UTC(ctY, ctM - 1, ctD, ctH, ctMin, ctS);
  const offsetMs = now.getTime() - ctAsIfUtc;
  // Midnight CT today = UTC instant of (today in CT, 00:00:00) plus the offset.
  return new Date(Date.UTC(ctY, ctM - 1, ctD, 0, 0, 0) + offsetMs);
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

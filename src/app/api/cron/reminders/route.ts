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

  return NextResponse.json({
    now: now.toISOString(),
    teeTimesChecked: teeTimes.length,
    sent,
    skippedPrefs,
    failed,
    errors,
  });
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

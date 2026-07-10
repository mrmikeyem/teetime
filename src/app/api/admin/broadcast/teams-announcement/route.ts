import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mailer";
import { teamsAnnouncementEmail } from "@/lib/email-templates";
import { mintToken, buildActionUrl } from "@/lib/email-actions";

const APP_URL = process.env.AUTH_URL ?? "https://tee3golf.com";
const UNSUBSCRIBE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * One-off enhancement announcement: the /teams team generator.
 *
 * Admin-only. POST { dryRun?: boolean, testTo?: string }.
 *   - testTo: send only to that address (must be a member) — use to preview.
 *   - dryRun: return the recipient list without sending.
 * Respects the unsubscribedAll kill switch. Sends are throttled inside the
 * mailer, so we just await them in sequence.
 */
export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { dryRun?: boolean; testTo?: string } = {};
  try {
    body = await req.json();
  } catch {
    // empty body is fine — defaults to a real send to everyone
  }

  // Eligible = has an email and hasn't unsubscribed from everything.
  const recipients = await prisma.user.findMany({
    where: {
      email: { not: null },
      OR: [
        { notificationPrefs: null },
        { notificationPrefs: { unsubscribedAll: false } },
      ],
    },
    select: { id: true, name: true, email: true },
  });

  let targets = recipients;
  if (body.testTo) {
    const wanted = body.testTo.trim().toLowerCase();
    targets = recipients.filter((r) => r.email?.toLowerCase() === wanted);
    if (targets.length === 0) {
      return NextResponse.json(
        { error: `No eligible member matches ${body.testTo}` },
        { status: 404 }
      );
    }
  }

  if (body.dryRun) {
    return NextResponse.json({
      dryRun: true,
      count: targets.length,
      recipients: targets.map((r) => r.email),
    });
  }

  const results = await Promise.allSettled(
    targets.map(async (r) => {
      const unsubscribe = await mintToken({
        userId: r.id,
        action: "unsubscribe",
        ttlMs: UNSUBSCRIBE_TTL_MS,
      });
      const { subject, text, html } = teamsAnnouncementEmail({
        name: r.name,
        appUrl: APP_URL,
        unsubscribeUrl: buildActionUrl(unsubscribe.rawToken, "unsubscribe"),
      });
      await sendMail({
        to: r.email!,
        subject,
        text,
        html,
        kind: "enhancement-announcement",
      });
    })
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.length - sent;
  return NextResponse.json({ sent, failed, total: results.length });
}

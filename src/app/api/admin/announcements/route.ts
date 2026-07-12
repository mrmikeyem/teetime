import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mailer";
import { announcementEmail } from "@/lib/email-templates";
import { mintToken, buildActionUrl } from "@/lib/email-actions";
import { recordNotification } from "@/lib/notification-feed";
import { broadcastChange } from "@/lib/events";

const APP_URL = process.env.AUTH_URL ?? "https://tee3golf.com";
const UNSUBSCRIBE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Publish an announcement: persists the row (its permanent home is
 * /whats-new), optionally nudges every member's bell, optionally emails
 * members (pref-filtered like the one-off broadcast routes this replaces).
 */
export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    title?: string;
    body?: string;
    url?: string | null;
    notifyBell?: boolean;
    notifyEmail?: boolean;
  };

  const title = body.title?.trim() ?? "";
  const text = body.body?.trim() ?? "";
  const url = body.url?.trim() || null;
  if (!title || title.length > 120) {
    return NextResponse.json({ error: "Title is required (max 120 chars)" }, { status: 400 });
  }
  if (!text || text.length > 2000) {
    return NextResponse.json({ error: "Body is required (max 2000 chars)" }, { status: 400 });
  }
  if (url && (!url.startsWith("/") || url.length > 300)) {
    return NextResponse.json(
      { error: 'Link must be an in-app path starting with "/"' },
      { status: 400 }
    );
  }

  const announcement = await prisma.announcement.create({
    data: { title, body: text, url },
  });

  let bells = 0;
  if (body.notifyBell) {
    const users = await prisma.user.findMany({ select: { id: true } });
    await Promise.allSettled(
      users.map((u) =>
        recordNotification({
          userId: u.id,
          type: "announcement",
          title,
          body: text,
          url: url ?? "/whats-new",
        })
      )
    );
    bells = users.length;
    broadcastChange(); // bells are server-rendered; SSE makes them refresh now
  }

  let emails = 0;
  if (body.notifyEmail) {
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
    const results = await Promise.allSettled(
      recipients.map(async (r) => {
        const unsubscribe = await mintToken({
          userId: r.id,
          action: "unsubscribe",
          ttlMs: UNSUBSCRIBE_TTL_MS,
        });
        const mail = announcementEmail({
          name: r.name,
          title,
          body: text,
          linkUrl: url,
          appUrl: APP_URL,
          unsubscribeUrl: buildActionUrl(unsubscribe.rawToken, "unsubscribe"),
        });
        await sendMail({
          to: r.email!,
          subject: mail.subject,
          text: mail.text,
          html: mail.html,
          kind: "enhancement-announcement",
        });
      })
    );
    emails = results.filter((r) => r.status === "fulfilled").length;
  }

  return NextResponse.json({ ok: true, id: announcement.id, bells, emails });
}

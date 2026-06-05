import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { geocodeCourse } from "@/lib/weather";
import { broadcastChange } from "@/lib/events";
import { notifyNewTeeTime } from "@/lib/notification-events";
import { sendMail } from "@/lib/mailer";
import {
  inboundCreatedEmail,
  inboundDuplicateEmail,
  inboundFailedEmail,
} from "@/lib/email-templates";
import {
  verifyResendWebhook,
  fetchReceivedEmail,
  extractTeeTime,
  ctWallTimeToUtc,
} from "@/lib/inbound-email";

const APP_URL = process.env.AUTH_URL ?? "https://tee3golf.com";

/**
 * Resend `email.received` webhook: a member forwarded a booking confirmation
 * to tee@tee3golf.com. Verify it's really Resend, make sure the sender is one
 * of our members (forwarding rewrites From: to the member's address — that IS
 * the auth), extract the booking with Claude, dedupe, create, fan out.
 *
 * Webhook contract: 2xx = handled (including "sender unknown" and "couldn't
 * parse" — retrying won't change those). Non-2xx = transient failure, Resend
 * retries with backoff.
 */

// Resend retries deliveries; this process is the only one (systemd, single
// node), so a module-scope set is enough to make retries idempotent without
// a schema change. The dedupe-by-teeOffAt check below covers restarts.
const processedEmailIds = new Set<string>();

const normalizeCourseKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Booking systems often report a facility name rather than the course the
 * group actually uses in the app (ForeUp says "King's Walk or Lincoln Golf
 * Course"; the board says "Kings Walk"). If the extracted name fuzzy-matches
 * a course we've already played, reuse that spelling — it keeps the list
 * consistent and geocodes correctly.
 */
async function canonicalizeCourse(extracted: string): Promise<string> {
  const rows = await prisma.teeTime.findMany({
    distinct: ["course"],
    select: { course: true },
  });
  const key = normalizeCourseKey(extracted);
  if (!key) return extracted;
  // Shortest key first so the most specific existing name wins.
  const known = rows
    .map((r) => r.course)
    .sort((a, b) => normalizeCourseKey(a).length - normalizeCourseKey(b).length);
  for (const course of known) {
    const k = normalizeCourseKey(course);
    if (k && (key.includes(k) || k.includes(key))) return course;
  }
  return extracted;
}

export async function POST(req: Request) {
  const rawBody = await req.text();

  const verified = verifyResendWebhook(rawBody, {
    id: req.headers.get("svix-id"),
    timestamp: req.headers.get("svix-timestamp"),
    signature: req.headers.get("svix-signature"),
  });
  if (!verified) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: { type?: string; data?: { email_id?: string; from?: string; subject?: string } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Bad payload" }, { status: 400 });
  }

  if (event.type !== "email.received" || !event.data?.email_id) {
    return NextResponse.json({ ignored: true });
  }

  const emailId = event.data.email_id;
  const fromAddr = (event.data.from ?? "").trim();

  if (processedEmailIds.has(emailId)) {
    return NextResponse.json({ ignored: "already processed" });
  }

  // Sender must be a member. Unknown senders are dropped silently — never
  // reply to strangers (backscatter). User.email is nullable; this query
  // only matches rows that have one.
  const sender = fromAddr
    ? await prisma.user.findFirst({
        where: { email: { equals: fromAddr, mode: "insensitive" } },
        select: { id: true, name: true, email: true },
      })
    : null;
  if (!sender?.email) {
    console.log(`[inbound-email] dropped mail from non-member: ${fromAddr}`);
    processedEmailIds.add(emailId);
    return NextResponse.json({ ignored: "unknown sender" });
  }

  const replyFailed = (reason: string) => {
    const tpl = inboundFailedEmail({ name: sender.name, reason });
    void sendMail({ to: sender.email!, ...tpl, kind: "inbound-failed" }).catch(
      () => {}
    );
  };

  try {
    const email = await fetchReceivedEmail(emailId);
    const extraction = await extractTeeTime(email);

    if (!extraction) {
      // Model/API failure, empty body, etc. — not retryable in a useful way.
      processedEmailIds.add(emailId);
      replyFailed(
        "I couldn't make sense of the email contents. If it was forwarded as an attachment, try forwarding it inline instead."
      );
      return NextResponse.json({ handled: "extraction failed" });
    }

    if (!extraction.is_confirmation || !extraction.date || !extraction.time) {
      processedEmailIds.add(emailId);
      replyFailed(
        "it doesn't look like a tee time confirmation (or the date/time wasn't in it)."
      );
      return NextResponse.json({ handled: "not a confirmation" });
    }

    const teeOffAt = ctWallTimeToUtc(extraction.date, extraction.time);
    if (!teeOffAt) {
      processedEmailIds.add(emailId);
      replyFailed(`I couldn't parse the date/time ("${extraction.date} ${extraction.time}").`);
      return NextResponse.json({ handled: "bad datetime" });
    }
    if (teeOffAt.getTime() < Date.now()) {
      processedEmailIds.add(emailId);
      replyFailed("that tee time is in the past.");
      return NextResponse.json({ handled: "past tee time" });
    }

    const course = await canonicalizeCourse(
      extraction.course?.trim() || "Kings Walk"
    );

    // Dedupe on the exact tee-off instant: one group, so two tee times at the
    // same minute are the same booking (second member forwarding the same
    // confirmation, a webhook redelivery after restart, or a manually created
    // entry).
    const existing = await prisma.teeTime.findFirst({
      where: { teeOffAt },
      select: { id: true, course: true, teeOffAt: true },
    });
    if (existing) {
      processedEmailIds.add(emailId);
      const tpl = inboundDuplicateEmail({
        name: sender.name,
        course: existing.course,
        teeOffAt: existing.teeOffAt,
        teeTimeUrl: `${APP_URL}/tee-times/${existing.id}`,
      });
      void sendMail({ to: sender.email, ...tpl, kind: "inbound-duplicate" }).catch(
        () => {}
      );
      return NextResponse.json({ handled: "duplicate", id: existing.id });
    }

    const players = extraction.players;
    const partySize =
      players != null && Number.isInteger(players)
        ? Math.min(5, Math.max(1, players))
        : 4;

    const noteLines = [`Created from ${sender.name}'s forwarded confirmation email.`];
    if (extraction.confirmation_number) {
      noteLines.push(`Confirmation #${extraction.confirmation_number}`);
    }
    if (extraction.holes === 9) noteLines.push("9 holes");

    const coords = await geocodeCourse(course).catch(() => null);

    const teeTime = await prisma.teeTime.create({
      data: {
        course,
        teeOffAt,
        partySize,
        lat: coords?.lat ?? null,
        lon: coords?.lon ?? null,
        notes: noteLines.join("\n"),
        createdBy: sender.id,
        members: {
          create: [{ userId: sender.id, addedBy: sender.id, confirmed: true }],
        },
      },
    });

    processedEmailIds.add(emailId);
    broadcastChange(teeTime.id);

    // Fan-out + reply ride the mailer queue; don't hold the webhook open.
    void notifyNewTeeTime({ teeTimeId: teeTime.id, bookerUserId: sender.id });
    const tpl = inboundCreatedEmail({
      name: sender.name,
      course,
      teeOffAt,
      teeTimeUrl: `${APP_URL}/tee-times/${teeTime.id}`,
    });
    void sendMail({ to: sender.email, ...tpl, kind: "inbound-created" }).catch(
      () => {}
    );

    console.log(
      `[inbound-email] created tee time ${teeTime.id} (${course} @ ${teeOffAt.toISOString()}) from ${sender.email}`
    );
    return NextResponse.json({ created: teeTime.id }, { status: 201 });
  } catch (err) {
    // Transient (Resend fetch / Anthropic / DB hiccup): 500 so Resend retries.
    // Nothing was marked processed, and the dedupe check makes a retry that
    // lands after a partial success safe.
    console.error(`[inbound-email] processing failed for ${emailId}:`, err);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}

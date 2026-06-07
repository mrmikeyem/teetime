import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mailer";
import { feedbackSubmittedAdminEmail } from "@/lib/email-templates";
import { isFeedbackType, FEEDBACK_MAX_MESSAGE_LEN } from "@/lib/feedback-types";

/**
 * User feedback / feature requests. Session-authed. Saves a Feedback row and
 * emails every admin (Reply-To set to the submitter so a reply in the inbox
 * reaches them directly). The email rides the mailer queue + email_log like
 * every other send.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let type: unknown;
  let message: unknown;
  try {
    const body = await req.json();
    type = body?.type;
    message = body?.message;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (!isFeedbackType(type)) {
    return NextResponse.json(
      { error: "type must be one of bug, idea, other" },
      { status: 400 }
    );
  }
  const text = typeof message === "string" ? message.trim() : "";
  if (!text) {
    return NextResponse.json(
      { error: "Please include a message." },
      { status: 400 }
    );
  }
  if (text.length > FEEDBACK_MAX_MESSAGE_LEN) {
    return NextResponse.json(
      {
        error: `Message is too long (max ${FEEDBACK_MAX_MESSAGE_LEN} characters).`,
      },
      { status: 400 }
    );
  }

  // Persist first — the row is the source of truth even if email hiccups.
  await prisma.feedback.create({
    data: { userId: session.user.id, type, message: text },
  });

  const [submitter, admins] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { name: true, email: true },
    }),
    prisma.user.findMany({
      where: { role: "ADMIN" },
      select: { email: true },
    }),
  ]);

  const { subject, text: emailText, html } = feedbackSubmittedAdminEmail({
    submitterName: submitter?.name ?? session.user.name ?? "A member",
    submitterEmail: submitter?.email ?? "no email on file",
    type,
    message: text,
  });

  // Reply-To only when we have a real submitter address.
  const replyTo = submitter?.email ?? undefined;

  const adminEmails = admins
    .map((a) => a.email)
    .filter((email): email is string => !!email);

  // The Feedback row is the source of truth, so the user still succeeds even
  // if no admin can be emailed — but that's an operational problem worth a
  // server-side warning (it should never happen in prod: 2 admins with email).
  if (adminEmails.length === 0) {
    console.error(
      "[feedback] saved a Feedback row but NO admin has an email to notify"
    );
  } else {
    const results = await Promise.allSettled(
      adminEmails.map((email) =>
        sendMail({
          to: email,
          subject,
          text: emailText,
          html,
          kind: "feedback",
          replyTo,
        })
      )
    );
    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed === adminEmails.length) {
      console.error(
        `[feedback] all ${failed} admin notification email(s) failed to send`
      );
    } else if (failed > 0) {
      console.error(
        `[feedback] ${failed}/${adminEmails.length} admin notification email(s) failed`
      );
    }
  }

  return NextResponse.json({ ok: true });
}

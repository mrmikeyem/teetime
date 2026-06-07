import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mailer";
import { feedbackSubmittedAdminEmail } from "@/lib/email-templates";

const VALID_TYPES: ReadonlySet<string> = new Set(["bug", "idea", "other"]);
const MAX_MESSAGE_LEN = 4000;

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

  if (typeof type !== "string" || !VALID_TYPES.has(type)) {
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
  if (text.length > MAX_MESSAGE_LEN) {
    return NextResponse.json(
      { error: `Message is too long (max ${MAX_MESSAGE_LEN} characters).` },
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

  await Promise.allSettled(
    admins
      .map((a) => a.email)
      .filter((email): email is string => !!email)
      .map((email) =>
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

  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { randomBytes, createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin";
import { sendMail } from "@/lib/mailer";
import { inviteUserEmail } from "@/lib/email-templates";

const APP_URL = process.env.AUTH_URL ?? "https://tee3golf.com";
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { email, role } = await req.json();

  const emailClean = email?.trim().toLowerCase() || null;
  if (!emailClean || !emailClean.includes("@")) {
    return NextResponse.json(
      { error: "A valid email is required" },
      { status: 400 }
    );
  }

  // Only EVENT may be requested at invite time (event-only guests). BASIC is
  // the default; ADMIN promotion stays a separate, deliberate action.
  if (role != null && role !== "BASIC" && role !== "EVENT") {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const emailTaken = await prisma.user.findUnique({
    where: { email: emailClean },
  });
  if (emailTaken) {
    return NextResponse.json(
      { error: "Email already in use" },
      { status: 409 }
    );
  }

  // Provisional name/username — the invited user supplies their real name when
  // they complete /set-password. username is unique + non-nullable, so seed it
  // with the email local-part plus a random suffix to avoid collisions; both
  // get overwritten at completion.
  const localPart = emailClean.split("@")[0].replace(/[^a-z0-9]/g, "") || "user";
  const provisionalUsername = `${localPart}-${randomBytes(4).toString("hex")}`;

  // passwordHash is non-nullable; seed it with a random unusable value that no
  // one knows — login is impossible until the user completes /set-password.
  const placeholderHash = await bcrypt.hash(
    randomBytes(32).toString("hex"),
    12
  );

  const user = await prisma.user.create({
    data: {
      username: provisionalUsername,
      name: emailClean,
      email: emailClean,
      passwordHash: placeholderHash,
      ...(role === "EVENT" ? { role: "EVENT" as const } : {}),
    },
    select: { id: true },
  });

  // Mint a single-use, time-limited invite token, consumed by
  // /api/auth/complete-invite, and email the setup link.
  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    },
  });

  const setupUrl = `${APP_URL}/set-password?token=${rawToken}`;
  const { subject, text, html } = inviteUserEmail({ setupUrl });

  try {
    await sendMail({ to: emailClean, subject, text, html, kind: "invite" });
  } catch {
    return NextResponse.json(
      {
        ok: true,
        warning:
          "User created, but the invite email failed to send. Try resending later.",
      },
      { status: 201 }
    );
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}

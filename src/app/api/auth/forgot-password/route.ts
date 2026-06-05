import { NextResponse } from "next/server";
import { randomBytes, createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mailer";
import { passwordResetEmail } from "@/lib/email-templates";

const TOKEN_TTL_MS = 60 * 60 * 1000;

export async function POST(req: Request) {
  const { email } = await req.json();
  const emailClean = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!emailClean) {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { email: emailClean } });

  if (user) {
    const rawToken = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    const origin = req.headers.get("origin") ?? process.env.AUTH_URL ?? "";
    const resetUrl = `${origin}/reset-password?token=${rawToken}`;

    const { subject, text, html } = passwordResetEmail({
      name: user.name,
      resetUrl,
    });
    await sendMail({ to: emailClean, subject, text, html, kind: "password-reset" });
  }

  return NextResponse.json({ ok: true });
}

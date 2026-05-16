import { NextResponse } from "next/server";
import { randomBytes, createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mailer";

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

    await sendMail({
      to: emailClean,
      subject: "Reset your Tee Times password",
      text:
        `Hi ${user.name},\n\n` +
        `Click the link below to reset your password. It expires in 1 hour.\n\n` +
        `${resetUrl}\n\n` +
        `If you didn't request this, you can ignore this email.`,
    });
  }

  return NextResponse.json({ ok: true });
}

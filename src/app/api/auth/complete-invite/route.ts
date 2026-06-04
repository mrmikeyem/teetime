import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const { token, firstName, lastName, password } = await req.json();

  if (typeof token !== "string" || !token) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }
  if (!firstName?.trim() || !lastName?.trim()) {
    return NextResponse.json(
      { error: "First and last name are required" },
      { status: 400 }
    );
  }
  if (typeof password !== "string" || password.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters" },
      { status: 400 }
    );
  }

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
  });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return NextResponse.json(
      { error: "This invite link is invalid or has expired." },
      { status: 400 }
    );
  }

  const name = `${firstName.trim()} ${lastName.trim()}`;
  const baseUsername =
    `${firstName.trim()}${lastName.trim()}`.toLowerCase().replace(/[^a-z0-9]/g, "");

  // Find a free username — same convention as elsewhere, with a numeric suffix
  // on collision (e.g. johnsmith, johnsmith2). Exclude this user's own
  // provisional username so re-finalizing is idempotent.
  let username = baseUsername || "user";
  for (let n = 2; ; n++) {
    const taken = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });
    if (!taken || taken.id === record.userId) break;
    username = `${baseUsername}${n}`;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { name, username, passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    prisma.passwordResetToken.deleteMany({
      where: { userId: record.userId, usedAt: null, id: { not: record.id } },
    }),
  ]);

  return NextResponse.json({ ok: true, username });
}

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/admin";

export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { firstName, lastName, email, phone, password } = await req.json();

  if (!firstName?.trim() || !lastName?.trim() || !password) {
    return NextResponse.json(
      { error: "First name, last name, and password are required" },
      { status: 400 }
    );
  }

  if (password.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters" },
      { status: 400 }
    );
  }

  const name = `${firstName.trim()} ${lastName.trim()}`;
  const username = `${firstName.trim()}${lastName.trim()}`.toLowerCase();
  const phoneClean = phone?.trim() || null;
  const emailClean = email?.trim().toLowerCase() || null;

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    return NextResponse.json(
      { error: "Username already taken" },
      { status: 409 }
    );
  }

  if (emailClean) {
    const emailTaken = await prisma.user.findUnique({
      where: { email: emailClean },
    });
    if (emailTaken) {
      return NextResponse.json(
        { error: "Email already in use" },
        { status: 409 }
      );
    }
  }

  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.create({
    data: {
      username,
      name,
      email: emailClean,
      phone: phoneClean,
      passwordHash,
    },
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}

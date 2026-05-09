import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { firstName, lastName } = await req.json();

  const first = (firstName ?? "").trim();
  const last = (lastName ?? "").trim();
  if (!first || !last) {
    return NextResponse.json(
      { error: "First and last name are required" },
      { status: 400 }
    );
  }

  const name = `${first} ${last}`;
  const baseUsername = `${first}${last}`.toLowerCase().replace(/[^a-z0-9]/g, "");

  let username = baseUsername;
  let suffix = 1;
  while (await prisma.user.findUnique({ where: { username } })) {
    suffix += 1;
    username = `${baseUsername}${suffix}`;
  }

  const user = await prisma.user.create({
    data: { username, name, isStub: true },
    select: { id: true, name: true, isStub: true },
  });

  return NextResponse.json({ user }, { status: 201 });
}

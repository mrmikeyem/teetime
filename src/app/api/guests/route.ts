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

  const guest = await prisma.guest.create({
    data: {
      name: `${first} ${last}`,
      addedBy: session.user.id,
    },
    select: { id: true, name: true },
  });

  return NextResponse.json({ guest }, { status: 201 });
}

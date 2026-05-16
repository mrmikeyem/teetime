import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const session = await auth();
  const { id } = await params;
  const body = await req.json();
  const next = body.role;

  if (next !== "BASIC" && next !== "ADMIN") {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true },
  });
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Guard: don't strand the system without an admin.
  if (target.id === session?.user.id && next === "BASIC") {
    const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
    if (adminCount <= 1) {
      return NextResponse.json(
        { error: "You're the only admin — promote someone else first" },
        { status: 409 }
      );
    }
  }

  await prisma.user.update({
    where: { id },
    data: { role: next },
  });

  return NextResponse.json({ ok: true });
}

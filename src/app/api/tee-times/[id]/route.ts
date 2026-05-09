import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const result = await prisma.teeTime.deleteMany({ where: { id } });
  if (result.count === 0) {
    return NextResponse.json({ error: "Tee time not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

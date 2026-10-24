import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

/** Grant / revoke a member's access to the sim wheel (/sim). */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const { simAccess } = await req.json();
  if (typeof simAccess !== "boolean") {
    return NextResponse.json({ error: "simAccess (boolean) required" }, { status: 400 });
  }
  const result = await prisma.user.updateMany({ where: { id }, data: { simAccess } });
  if (result.count === 0) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

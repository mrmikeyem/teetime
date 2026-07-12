import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

// Deleting removes the row from /whats-new; bell rows already recorded for
// it are left alone (they age out via the feed's normal pruning).
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  await prisma.announcement.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ ok: true });
}

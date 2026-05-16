import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const session = await auth();
  const { id } = await params;

  if (id === session?.user.id) {
    return NextResponse.json(
      { error: "Can't delete your own account" },
      { status: 409 }
    );
  }

  const target = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      _count: {
        select: {
          createdTeeTimes: true,
          memberships: true,
          addedGuests: true,
        },
      },
    },
  });
  if (!target) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (
    target._count.createdTeeTimes > 0 ||
    target._count.memberships > 0 ||
    target._count.addedGuests > 0
  ) {
    return NextResponse.json(
      {
        error:
          "Can't delete — user has tee times, memberships, or added guests. Remove those first.",
      },
      { status: 409 }
    );
  }

  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}

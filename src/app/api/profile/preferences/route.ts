import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const data = {
    reminders: !!body.reminders,
    addedTo: !!body.addedTo,
    joinedByOther: !!body.joinedByOther,
    leftByOther: !!body.leftByOther,
    unsubscribedAll: !!body.unsubscribedAll,
  };

  await prisma.notificationPreference.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, ...data },
    update: data,
  });

  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim();
  const excludeUsersParam = searchParams.get("excludeUsers") ?? "";
  const excludeGuestsParam = searchParams.get("excludeGuests") ?? "";
  const excludeUsers = excludeUsersParam ? excludeUsersParam.split(",").filter(Boolean) : [];
  const excludeGuests = excludeGuestsParam ? excludeGuestsParam.split(",").filter(Boolean) : [];

  if (q.length < 1) {
    return NextResponse.json({ users: [], guests: [] });
  }

  const [users, guests] = await Promise.all([
    prisma.user.findMany({
      where: {
        name: { contains: q, mode: "insensitive" },
        ...(excludeUsers.length ? { id: { notIn: excludeUsers } } : {}),
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 10,
    }),
    prisma.guest.findMany({
      where: {
        name: { contains: q, mode: "insensitive" },
        ...(excludeGuests.length ? { id: { notIn: excludeGuests } } : {}),
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 10,
    }),
  ]);

  return NextResponse.json({ users, guests });
}

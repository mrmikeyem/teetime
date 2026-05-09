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
  const excludeParam = searchParams.get("exclude") ?? "";
  const exclude = excludeParam ? excludeParam.split(",").filter(Boolean) : [];

  if (q.length < 1) {
    return NextResponse.json({ users: [] });
  }

  const users = await prisma.user.findMany({
    where: {
      name: { contains: q, mode: "insensitive" },
      ...(exclude.length ? { id: { notIn: exclude } } : {}),
    },
    select: { id: true, name: true, isStub: true },
    orderBy: { name: "asc" },
    take: 10,
  });

  return NextResponse.json({ users });
}

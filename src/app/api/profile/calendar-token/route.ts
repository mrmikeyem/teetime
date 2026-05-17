import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Generate a calendar feed token if the user doesn't have one,
 * or rotate it (revoke + regenerate) when body includes { rotate: true }.
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { rotate?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    // empty body is fine — treated as "generate if missing"
  }

  const current = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { calendarFeedToken: true },
  });
  if (!current) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (current.calendarFeedToken && !body.rotate) {
    return NextResponse.json({ token: current.calendarFeedToken });
  }

  const newToken = randomBytes(32).toString("base64url");
  await prisma.user.update({
    where: { id: session.user.id },
    data: { calendarFeedToken: newToken },
  });

  return NextResponse.json({ token: newToken });
}

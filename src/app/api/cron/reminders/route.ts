import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";

const REMIND_BEFORE_MIN = 60;
const WINDOW_MIN = 5;

export async function POST(req: Request) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const windowStart = new Date(now.getTime() + (REMIND_BEFORE_MIN - WINDOW_MIN) * 60 * 1000);
  const windowEnd = new Date(now.getTime() + (REMIND_BEFORE_MIN + WINDOW_MIN) * 60 * 1000);

  const teeTimes = await prisma.teeTime.findMany({
    where: { teeOffAt: { gte: windowStart, lte: windowEnd } },
    include: {
      members: {
        where: {
          userId: { not: null },
          remindedAt: null,
          user: { email: { not: null } },
        },
        include: { user: { select: { id: true, name: true, email: true } } },
      },
    },
  });

  const eligible = teeTimes.flatMap((t) =>
    t.members.map((m) => ({
      teeTimeId: t.id,
      memberId: m.id,
      userId: m.user!.id,
      userName: m.user!.name,
      userEmail: m.user!.email,
      course: t.course,
      teeOffAt: t.teeOffAt.toISOString(),
    }))
  );

  return NextResponse.json({
    dryRun: true,
    now: now.toISOString(),
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),
    teeTimesChecked: teeTimes.length,
    eligibleCount: eligible.length,
    eligible,
  });
}

function authorize(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const provided = req.headers.get("x-cron-secret") ?? "";
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

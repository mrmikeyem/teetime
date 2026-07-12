import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { refreshRoundSummary } from "@/lib/weather-summary-cache";

// Forces a fresh Open-Meteo fetch + Claude call for one tee time's
// "what to expect" blurb (the Refresh button when the cache is stale).
export async function POST(req: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { teeTimeId?: string };
  if (!body.teeTimeId) {
    return NextResponse.json({ error: "teeTimeId required" }, { status: 400 });
  }

  const teeTime = await prisma.teeTime.findUnique({
    where: { id: body.teeTimeId },
    select: { id: true, lat: true, lon: true, teeOffAt: true, course: true },
  });
  if (!teeTime || teeTime.lat == null || teeTime.lon == null) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await refreshRoundSummary({
    id: teeTime.id,
    lat: teeTime.lat,
    lon: teeTime.lon,
    teeOffAt: teeTime.teeOffAt,
    course: teeTime.course,
  });
  return NextResponse.json({ ok: true });
}

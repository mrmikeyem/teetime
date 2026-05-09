import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { geocodeCourse, getWeatherForTeeTime } from "@/lib/weather";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const course = (searchParams.get("course") ?? "").trim();
  const teeOffAt = searchParams.get("teeOffAt") ?? "";

  if (!course || !teeOffAt) {
    return NextResponse.json({ weather: null });
  }

  const when = new Date(teeOffAt);
  if (isNaN(when.getTime())) {
    return NextResponse.json({ weather: null });
  }

  const coords = await geocodeCourse(course).catch(() => null);
  if (!coords) {
    return NextResponse.json({ weather: null });
  }

  const weather = await getWeatherForTeeTime(coords, when).catch(() => null);
  return NextResponse.json({ weather });
}

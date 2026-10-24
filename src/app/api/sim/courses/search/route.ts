import { NextResponse } from "next/server";
import { requireSimApi } from "@/lib/sim";
import { GolfApiNotConfigured, searchCourses } from "@/lib/golf-course-api";

export async function GET(req: Request) {
  const { error } = await requireSimApi();
  if (error) return error;
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ error: "Enter at least 2 characters" }, { status: 400 });
  }
  try {
    return NextResponse.json({ courses: await searchCourses(q) });
  } catch (err) {
    if (err instanceof GolfApiNotConfigured) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    console.error("[sim] course search failed:", err);
    return NextResponse.json({ error: "Search failed" }, { status: 502 });
  }
}

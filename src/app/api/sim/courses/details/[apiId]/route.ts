import { NextResponse } from "next/server";
import { requireSimApi } from "@/lib/sim";
import { getCourseDetails } from "@/lib/golf-course-api";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ apiId: string }> }
) {
  const { error } = await requireSimApi();
  if (error) return error;
  const apiId = (await params).apiId;
  if (!/^[A-Za-z0-9]{1,32}$/.test(apiId)) {
    return NextResponse.json({ error: "Invalid course id" }, { status: 400 });
  }
  try {
    const course = await getCourseDetails(apiId);
    if (!course) {
      return NextResponse.json({ error: "No details for this course" }, { status: 404 });
    }
    return NextResponse.json({ course });
  } catch (err) {
    console.error("[sim] course details failed:", err);
    return NextResponse.json({ error: "Couldn't load course details" }, { status: 502 });
  }
}

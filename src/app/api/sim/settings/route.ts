import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { broadcastChange } from "@/lib/events";
import { requireSimApi } from "@/lib/sim";

const COURSE_LIMITS = [0, 1, 2, 3, 5, 10];

/** Update the group's wheel settings (any subset of fields). */
export async function PATCH(req: Request) {
  const { error } = await requireSimApi();
  if (error) return error;
  const body = await req.json();
  const data: {
    courseLimit?: number;
    tallyEnabled?: boolean;
    tallyMode?: "ADDITIVE" | "MULTIPLIER";
    tallyMultiplier?: number;
  } = {};

  if (body.courseLimit !== undefined) {
    if (!COURSE_LIMITS.includes(body.courseLimit)) {
      return NextResponse.json({ error: "Invalid course limit" }, { status: 400 });
    }
    data.courseLimit = body.courseLimit;
  }
  if (body.tallyEnabled !== undefined) {
    if (typeof body.tallyEnabled !== "boolean") {
      return NextResponse.json({ error: "Invalid tallyEnabled" }, { status: 400 });
    }
    data.tallyEnabled = body.tallyEnabled;
  }
  if (body.tallyMode !== undefined) {
    if (body.tallyMode !== "ADDITIVE" && body.tallyMode !== "MULTIPLIER") {
      return NextResponse.json({ error: "Invalid tally mode" }, { status: 400 });
    }
    data.tallyMode = body.tallyMode;
  }
  if (body.tallyMultiplier !== undefined) {
    const m = Number(body.tallyMultiplier);
    if (!Number.isFinite(m) || m < 1.1 || m > 3) {
      return NextResponse.json(
        { error: "Multiplier must be between 1.1 and 3" },
        { status: 400 }
      );
    }
    data.tallyMultiplier = Math.round(m * 10) / 10;
  }

  await prisma.simSettings.upsert({
    where: { id: 1 },
    create: { id: 1, ...data },
    update: data,
  });
  broadcastChange();
  return NextResponse.json({ ok: true });
}

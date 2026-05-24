import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function normalize(v: unknown): string | null | "INVALID" {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") return "INVALID";
  const s = v.trim();
  if (s === "") return null;
  return TIME_RE.test(s) ? s : "INVALID";
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const weeknight = normalize(body.weeknightDefault);
  const weekend = normalize(body.weekendDefault);

  if (weeknight === "INVALID" || weekend === "INVALID") {
    return NextResponse.json(
      { error: "Times must be in HH:MM 24-hour format" },
      { status: 400 }
    );
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      weeknightDefault: weeknight,
      weekendDefault: weekend,
    },
  });

  return NextResponse.json({ ok: true });
}

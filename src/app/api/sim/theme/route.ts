import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSimApi } from "@/lib/sim";
import { SIM_THEMES } from "@/app/(app)/sim/themes";

/** Save the viewer's wheel theme (follows them across devices). */
export async function PUT(req: Request) {
  const { viewer, error } = await requireSimApi();
  if (error) return error;
  const { theme } = await req.json();
  if (!SIM_THEMES.some((t) => t.id === theme)) {
    return NextResponse.json({ error: "Unknown theme" }, { status: 400 });
  }
  await prisma.user.update({
    where: { id: viewer.id },
    data: { simTheme: theme === "classic" ? null : theme },
  });
  return NextResponse.json({ ok: true });
}

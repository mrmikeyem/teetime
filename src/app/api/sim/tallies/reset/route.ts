import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { broadcastChange } from "@/lib/events";
import { requireSimApi } from "@/lib/sim";

/** Reset every course's tally to 0. */
export async function POST() {
  const { error } = await requireSimApi();
  if (error) return error;
  await prisma.simListEntry.updateMany({ data: { tally: 0 } });
  broadcastChange();
  return NextResponse.json({ ok: true });
}

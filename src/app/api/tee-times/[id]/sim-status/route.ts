import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { confirmSimNight, cancelSimNight } from "@/lib/sim-nights";

/** Host-only: turn a hosted sim night on or off ({ on: boolean }). */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  if (typeof body?.on !== "boolean") {
    return NextResponse.json({ error: "on (boolean) is required" }, { status: 400 });
  }

  try {
    if (body.on) await confirmSimNight(session.user.id, id);
    else await cancelSimNight(session.user.id, id);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Something went wrong.";
    return NextResponse.json({ error: message }, { status: 409 });
  }

  return NextResponse.json({ ok: true });
}

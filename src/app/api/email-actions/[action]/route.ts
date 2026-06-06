import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  verifyToken,
  markUsed,
  type EmailActionType,
  EmailActionError,
} from "@/lib/email-actions";
import { broadcastChange } from "@/lib/events";
import {
  confirmMembership,
  declineOrLeaveMembership,
  joinTeeTime,
} from "@/lib/tee-time-actions";

const APP_URL = process.env.AUTH_URL ?? "https://tee3golf.com";

const VALID_ACTIONS: ReadonlySet<EmailActionType> = new Set([
  "confirm",
  "decline",
  "leave",
  "join",
  "cancel_teetime",
  "unsubscribe",
]);

export async function POST(
  req: Request,
  { params }: { params: Promise<{ action: string }> }
) {
  const { action } = await params;
  if (!isAction(action)) return redirectToResult("error", "Unknown action.");

  let form;
  try {
    form = await req.formData();
  } catch {
    return redirectToResult("error", "Missing token.");
  }
  const token = form.get("token");
  if (typeof token !== "string" || !token) {
    return redirectToResult("error", "Missing token.");
  }

  let row;
  try {
    row = await verifyToken(token, action);
  } catch (err) {
    if (err instanceof EmailActionError) {
      const msg = {
        invalid: "This link is invalid.",
        expired: "This link has expired.",
        used: "This link has already been used.",
      }[err.code];
      return redirectToResult("error", msg);
    }
    throw err;
  }

  try {
    await runAction(action, row.userId, row.teeTimeId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Something went wrong.";
    return redirectToResult("error", message);
  }

  if (action !== "unsubscribe") {
    await markUsed(row.id);
  }

  const successMessage = {
    confirm: "You're confirmed. See you on the course!",
    decline: "You've declined. The group has been updated.",
    leave: "You've been removed from the tee time.",
    join: "You're added to the tee time.",
    cancel_teetime: "The tee time has been cancelled and removed for the group.",
    unsubscribe: "Unsubscribed. You won't receive more emails.",
  }[action];

  return redirectToResult("ok", successMessage);
}

async function runAction(
  action: EmailActionType,
  userId: string,
  teeTimeId: string | null
) {
  switch (action) {
    case "confirm": {
      if (!teeTimeId) throw new Error("Token is missing a tee time.");
      await confirmMembership(userId, teeTimeId);
      return;
    }
    case "decline":
    case "leave": {
      if (!teeTimeId) throw new Error("Token is missing a tee time.");
      await declineOrLeaveMembership(userId, teeTimeId);
      return;
    }
    case "join": {
      if (!teeTimeId) throw new Error("Token is missing a tee time.");
      await joinTeeTime(userId, teeTimeId);
      return;
    }
    case "cancel_teetime": {
      if (!teeTimeId) throw new Error("Token is missing a tee time.");
      // Only someone on the tee time may cancel the whole thing via this link.
      const membership = await prisma.teeTimeMember.findFirst({
        where: { teeTimeId, userId },
        select: { id: true },
      });
      if (!membership) {
        throw new Error("You're not on this tee time.");
      }
      const result = await prisma.teeTime.deleteMany({ where: { id: teeTimeId } });
      if (result.count === 0) {
        throw new Error("This tee time no longer exists.");
      }
      broadcastChange(teeTimeId);
      return;
    }
    case "unsubscribe": {
      await prisma.notificationPreference.upsert({
        where: { userId },
        create: { userId, unsubscribedAll: true },
        update: { unsubscribedAll: true },
      });
      return;
    }
  }
}

function isAction(s: string): s is EmailActionType {
  return VALID_ACTIONS.has(s as EmailActionType);
}

function redirectToResult(status: "ok" | "error", message: string) {
  const url = new URL("/email-actions/result", APP_URL);
  url.searchParams.set("status", status);
  url.searchParams.set("message", message);
  return NextResponse.redirect(url, 303);
}

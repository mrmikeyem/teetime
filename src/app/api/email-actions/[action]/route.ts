import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  verifyToken,
  markUsed,
  type EmailActionType,
  EmailActionError,
} from "@/lib/email-actions";
import {
  notifyMemberJoined,
  notifyMemberLeft,
} from "@/lib/notification-events";
import { broadcastChange } from "@/lib/events";

const APP_URL = process.env.AUTH_URL ?? "https://infiniterien.com";

const VALID_ACTIONS: ReadonlySet<EmailActionType> = new Set([
  "confirm",
  "decline",
  "leave",
  "join",
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

  if (action !== "unsubscribe" && row.teeTimeId) {
    broadcastChange(row.teeTimeId);
  }

  if (action !== "unsubscribe") {
    await markUsed(row.id);
  }

  const successMessage = {
    confirm: "You're confirmed. See you on the course!",
    decline: "You've declined. The group has been updated.",
    leave: "You've been removed from the tee time.",
    join: "You're added to the tee time.",
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
      const result = await prisma.teeTimeMember.updateMany({
        where: { teeTimeId, userId },
        data: { confirmed: true },
      });
      if (result.count === 0) {
        throw new Error("You're no longer on this tee time.");
      }
      return;
    }
    case "decline":
    case "leave": {
      if (!teeTimeId) throw new Error("Token is missing a tee time.");
      const teeTime = await prisma.teeTime.findUnique({
        where: { id: teeTimeId },
        include: {
          members: {
            include: { user: { select: { id: true, name: true } } },
          },
        },
      });
      if (!teeTime) throw new Error("Tee time not found.");
      const leaver = teeTime.members.find((m) => m.userId === userId)?.user;
      const remainingUserIds = teeTime.members
        .filter((m) => m.userId !== userId)
        .map((m) => m.userId)
        .filter((id): id is string => !!id);

      const result = await prisma.teeTimeMember.deleteMany({
        where: { teeTimeId, userId },
      });
      if (result.count === 0) {
        throw new Error("You weren't on this tee time.");
      }

      if (leaver) {
        await notifyMemberLeft({
          teeTimeId,
          leaverName: leaver.name,
          actorUserId: userId,
          remainingMemberUserIds: remainingUserIds,
          course: teeTime.course,
          teeOffAt: teeTime.teeOffAt,
        });
      }
      return;
    }
    case "join": {
      if (!teeTimeId) throw new Error("Token is missing a tee time.");
      const existing = await prisma.teeTimeMember.findFirst({
        where: { teeTimeId, userId },
      });
      if (existing) {
        throw new Error("You're already on this tee time.");
      }
      await prisma.teeTimeMember.create({
        data: { teeTimeId, userId, addedBy: userId, confirmed: true },
      });
      await notifyMemberJoined({
        teeTimeId,
        joinerUserId: userId,
        actorUserId: userId,
      });
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

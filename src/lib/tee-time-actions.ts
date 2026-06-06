import "server-only";
import { prisma } from "@/lib/prisma";
import { broadcastChange } from "@/lib/events";
import { notifyMemberJoined, notifyMemberLeft } from "@/lib/notification-events";

/**
 * Shared mutation cores for confirm / decline-or-leave / join, used by BOTH
 * the email-action token route (no session) and the in-app feed inline
 * actions (session). Each does the DB write, fires broadcastChange (SSE), and
 * runs the right notify* fan-out — so the two entry points behave identically.
 *
 * They throw Error(message) on a no-longer-valid action; callers translate
 * that into a user-facing message (a redirect for email, JSON for the feed).
 */

export async function confirmMembership(
  userId: string,
  teeTimeId: string
): Promise<void> {
  const result = await prisma.teeTimeMember.updateMany({
    where: { teeTimeId, userId },
    data: { confirmed: true },
  });
  if (result.count === 0) {
    throw new Error("You're no longer on this tee time.");
  }
  broadcastChange(teeTimeId);
}

/**
 * "decline" and "leave" are the same mutation — remove the member — and the
 * same notification (the group is told someone left). actorUserId is the
 * person performing it (== userId for both the email-link and inline cases).
 */
export async function declineOrLeaveMembership(
  userId: string,
  teeTimeId: string
): Promise<void> {
  const teeTime = await prisma.teeTime.findUnique({
    where: { id: teeTimeId },
    include: {
      members: { include: { user: { select: { id: true, name: true } } } },
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

  broadcastChange(teeTimeId);

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
}

export async function joinTeeTime(
  userId: string,
  teeTimeId: string
): Promise<void> {
  const existing = await prisma.teeTimeMember.findFirst({
    where: { teeTimeId, userId },
  });
  if (existing) {
    throw new Error("You're already on this tee time.");
  }
  await prisma.teeTimeMember.create({
    data: { teeTimeId, userId, addedBy: userId, confirmed: true },
  });

  broadcastChange(teeTimeId);

  await notifyMemberJoined({
    teeTimeId,
    joinerUserId: userId,
    actorUserId: userId,
  });
}

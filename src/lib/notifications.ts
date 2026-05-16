import "server-only";
import { prisma } from "@/lib/prisma";

export type NotificationEvent =
  | "reminder"
  | "addedTo"
  | "joinedByOther"
  | "leftByOther"
  | "newTeeTime";

const COLUMN_BY_EVENT: Record<NotificationEvent, "reminders" | "addedTo" | "joinedByOther" | "leftByOther" | "newTeeTime"> = {
  reminder: "reminders",
  addedTo: "addedTo",
  joinedByOther: "joinedByOther",
  leftByOther: "leftByOther",
  newTeeTime: "newTeeTime",
};

export async function shouldNotify(
  userId: string,
  event: NotificationEvent
): Promise<boolean> {
  const pref = await prisma.notificationPreference.findUnique({
    where: { userId },
  });
  return evaluate(pref, event);
}

export async function filterEligibleUsers(
  userIds: string[],
  event: NotificationEvent
): Promise<string[]> {
  if (userIds.length === 0) return [];
  const prefs = await prisma.notificationPreference.findMany({
    where: { userId: { in: userIds } },
  });
  const byUserId = new Map(prefs.map((p) => [p.userId, p]));
  return userIds.filter((id) => evaluate(byUserId.get(id) ?? null, event));
}

function evaluate(
  pref: {
    reminders: boolean;
    addedTo: boolean;
    joinedByOther: boolean;
    leftByOther: boolean;
    newTeeTime: boolean;
    unsubscribedAll: boolean;
  } | null,
  event: NotificationEvent
): boolean {
  if (!pref) return true;
  if (pref.unsubscribedAll) return false;
  return pref[COLUMN_BY_EVENT[event]];
}

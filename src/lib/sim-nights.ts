import "server-only";
import type { SimNightStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { broadcastChange } from "@/lib/events";
import {
  notifySimNightRequest,
  notifySimNightStatus,
} from "@/lib/notification-events";
import { appTzWallTimeToUtc, isoDateInAppTz } from "@/lib/time";

/**
 * Sim nights = TeeTime rows with type SIM + a simVenueId. At a HOSTED venue
 * (someone's garage) every night is the host's call:
 *  - the host books it            → CONFIRMED straight away
 *  - anyone else books it         → PENDING, host gets It's on / Not this time
 *  - the standing weekly night    → auto-proposed PENDING each Monday
 * Only the host flips status (confirmSimNight / cancelSimNight); a cancelled
 * night stays as a CANCELLED row (not deleted) so the group sees it's off and
 * the standing-night generator doesn't re-propose it. Unhosted venues
 * (Albatros) keep simStatus null and behave like a normal tee time.
 */

/** Status a new SIM tee time starts in, given its venue and who booked it. */
export function initialSimStatus(
  venue: { hostUserId: string | null },
  creatorId: string
): SimNightStatus | null {
  if (!venue.hostUserId) return null;
  return venue.hostUserId === creatorId ? "CONFIRMED" : "PENDING";
}

/** True when a tee time is actually happening (not waiting on / killed by a host). */
export function isSimNightLive(simStatus: SimNightStatus | null): boolean {
  return simStatus == null || simStatus === "CONFIRMED";
}

async function loadHostedNight(userId: string, teeTimeId: string) {
  const teeTime = await prisma.teeTime.findUnique({
    where: { id: teeTimeId },
    select: {
      id: true,
      teeOffAt: true,
      simStatus: true,
      simVenue: { select: { hostUserId: true } },
    },
  });
  if (!teeTime) throw new Error("This sim night no longer exists.");
  if (!teeTime.simVenue?.hostUserId || teeTime.simStatus == null) {
    throw new Error("This isn't a hosted sim night.");
  }
  if (teeTime.simVenue.hostUserId !== userId) {
    throw new Error("Only the host can do that.");
  }
  if (teeTime.teeOffAt.getTime() < Date.now()) {
    throw new Error("This sim night has already happened.");
  }
  return teeTime;
}

/**
 * Host says it's on (from PENDING, or reviving a CANCELLED night). Puts the
 * host on the roster, then tells everyone on it + broadcasts the open spots.
 */
export async function confirmSimNight(
  userId: string,
  teeTimeId: string
): Promise<void> {
  const teeTime = await loadHostedNight(userId, teeTimeId);
  if (teeTime.simStatus === "CONFIRMED") {
    throw new Error("It's already on.");
  }

  await prisma.$transaction([
    prisma.teeTime.update({
      where: { id: teeTimeId },
      data: { simStatus: "CONFIRMED" },
    }),
    prisma.teeTimeMember.upsert({
      where: { teeTimeId_userId: { teeTimeId, userId } },
      create: { teeTimeId, userId, addedBy: userId, confirmed: true },
      update: { confirmed: true },
    }),
  ]);

  broadcastChange(teeTimeId);
  await notifySimNightStatus({ teeTimeId, on: true });
}

/** Host says not this time. The roster is kept so it can be revived. */
export async function cancelSimNight(
  userId: string,
  teeTimeId: string
): Promise<void> {
  const teeTime = await loadHostedNight(userId, teeTimeId);
  if (teeTime.simStatus === "CANCELLED") {
    throw new Error("It's already off.");
  }

  await prisma.teeTime.update({
    where: { id: teeTimeId },
    data: { simStatus: "CANCELLED" },
  });

  broadcastChange(teeTimeId);
  await notifySimNightStatus({ teeTimeId, on: false });
}

/** Monday = the day the standing night for the week gets proposed. */
const PROPOSE_FROM_DOW = 1;

/**
 * Called from the 5-min reminders cron. For each hosted venue with a standing
 * night, once it's Monday-or-later of the week (CT) that night falls in,
 * propose it as PENDING and nudge the host — unless that venue already has a
 * sim tee time on that date (any status: the host may have booked or
 * cancelled it already). Idempotent, so running every tick is safe and a
 * missed Monday is caught up on the next tick.
 */
export async function proposeStandingSimNights(now: Date = new Date()) {
  const venues = await prisma.simVenue.findMany({
    where: {
      hostUserId: { not: null },
      standingDay: { not: null },
      standingTime: { not: null },
    },
  });

  const today = isoDateInAppTz(now);
  const todayDow = new Date(`${today}T12:00:00Z`).getUTCDay();
  // Days since this week's Monday (Mon=0 … Sun=6).
  const sinceMonday = (todayDow - PROPOSE_FROM_DOW + 7) % 7;

  let proposed = 0;
  for (const v of venues) {
    const targetOffset = (v.standingDay! - PROPOSE_FROM_DOW + 7) % 7;
    const daysAhead = targetOffset - sinceMonday;
    if (daysAhead < 0) continue; // this week's night already went by

    const date = addDays(today, daysAhead);
    const teeOffAt = appTzWallTimeToUtc(date, v.standingTime!);
    if (teeOffAt.getTime() <= now.getTime()) continue;

    const dayStart = appTzWallTimeToUtc(date, "00:00");
    const dayEnd = appTzWallTimeToUtc(addDays(date, 1), "00:00");
    const existing = await prisma.teeTime.findFirst({
      where: { simVenueId: v.id, teeOffAt: { gte: dayStart, lt: dayEnd } },
      select: { id: true },
    });
    if (existing) continue;

    const teeTime = await prisma.teeTime.create({
      data: {
        type: "SIM",
        course: v.name,
        simVenueId: v.id,
        simStatus: "PENDING",
        teeOffAt,
        partySize: 4,
        createdBy: v.hostUserId!,
      },
    });
    proposed++;

    broadcastChange(teeTime.id);
    await notifySimNightRequest({ teeTimeId: teeTime.id, requestedByUserId: null });
  }

  return { proposed };
}

/** "YYYY-MM-DD" + n calendar days. */
function addDays(isoDate: string, n: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

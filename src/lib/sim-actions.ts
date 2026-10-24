import "server-only";
import { prisma } from "@/lib/prisma";
import { broadcastChange } from "@/lib/events";
import { getSimSettings, loadWheelPlayers, teeColumns, type TeeInput } from "@/lib/sim";
import { buildWheel } from "@/lib/sim-wheel";

/**
 * Resolve a wheel outcome (Play or Skip) in ONE transaction. The old app did
 * this as two requests (bump tallies, then log), so a dropped second request
 * left tallies bumped with no play. The server recomputes the wheel from the
 * DB + the client's session skips rather than trusting client tally math.
 *
 * - Both: if tally weighting is on, every OTHER list row on the wheel gets +1.
 * - Play: log the round (players = everyone checked, suggesters = the
 *   winning slice's players) and take the course off EVERY list — the wheel
 *   is a collective, once it's played it's done.
 */
export async function resolveSpin(opts: {
  outcome: "play" | "skip";
  courseId: string;
  skippedCourseIds: string[];
  tee: TeeInput;
  source: "wheel" | "manual_play";
  loggedBy: string;
}): Promise<{ playId: string | null }> {
  const result = await prisma.$transaction(async (tx) => {
    const [players, settings] = await Promise.all([
      loadWheelPlayers(tx),
      getSimSettings(tx),
    ]);
    // Mode doesn't change eligibility, only odds — "equal" is fine here.
    const wheel = buildWheel(
      players,
      settings,
      new Set(opts.skippedCourseIds.filter((id) => id !== opts.courseId)),
      "equal"
    );
    const winner = wheel.find((s) => s.courseId === opts.courseId);
    if (!winner) throw new Error("That course isn't on the wheel anymore.");

    if (settings.tallyEnabled) {
      const others = wheel
        .filter((s) => s.courseId !== opts.courseId)
        .flatMap((s) => s.entryIds);
      if (others.length > 0) {
        await tx.simListEntry.updateMany({
          where: { id: { in: others } },
          data: { tally: { increment: 1 } },
        });
      }
    }

    if (opts.outcome === "skip") return { playId: null };

    const suggesterIds = new Set(winner.suggesters.map((s) => s.playerId));
    const playingIds = players.filter((p) => p.checked).map((p) => p.id);
    const play = await tx.simPlay.create({
      data: {
        courseId: opts.courseId,
        playedAt: new Date(),
        source: opts.source,
        loggedBy: opts.loggedBy,
        ...teeColumns(opts.tee),
        players: {
          create: Array.from(new Set([...playingIds, ...suggesterIds])).map(
            (playerId) => ({
              playerId,
              played: playingIds.includes(playerId),
              suggested: suggesterIds.has(playerId),
            })
          ),
        },
      },
      select: { id: true },
    });
    await tx.simListEntry.deleteMany({ where: { courseId: opts.courseId } });
    return { playId: play.id };
  });

  broadcastChange();
  return result;
}

/**
 * Sim wheel odds engine — pure and client-safe (no server-only), so the
 * wheel the browser draws and the tally bumps the server applies come from
 * the exact same eligibility math.
 *
 * Model (ported from the old PHP/JS Golf Course Wheel):
 * - Only CHECKED players' lists feed the wheel ("who's playing tonight").
 * - Each list is filtered by the session's skipped courses, THEN cut to the
 *   top `courseLimit` by drag order (so a skip promotes the next course).
 * - The same course on several lists is ONE combined slice; its suggesters
 *   are all of those players and its tally is the sum.
 * - Slice size is the slice's true probability of being picked, in both
 *   modes (the old app drew by-player mode with equal-mode sizes).
 */

export type SimTallyModeValue = "ADDITIVE" | "MULTIPLIER";
export type WheelMode = "equal" | "byPlayer";

export type WheelSettings = {
  courseLimit: number;
  tallyEnabled: boolean;
  tallyMode: SimTallyModeValue;
  tallyMultiplier: number;
};

export type WheelListEntry = {
  entryId: string;
  courseId: string;
  courseName: string;
  tally: number;
};

export type WheelPlayer = {
  id: string;
  name: string;
  checked: boolean;
  /** Already in drag order. */
  list: WheelListEntry[];
};

export type WheelEntry = {
  courseId: string;
  courseName: string;
  suggesters: { playerId: string; name: string }[];
  /** The list rows backing this slice (one per suggester). */
  entryIds: string[];
  totalTally: number;
  probability: number;
};

/** Slice weight from a tally, per the group's settings. */
export function tallyWeight(tally: number, s: WheelSettings): number {
  if (!s.tallyEnabled) return 1;
  if (s.tallyMode === "ADDITIVE") return 1 + tally;
  return Math.pow(s.tallyMultiplier, tally);
}

/** Each checked player's eligible list rows (skips removed, then top-N). */
export function eligibleByPlayer(
  players: WheelPlayer[],
  settings: WheelSettings,
  skipped: ReadonlySet<string>
): { player: WheelPlayer; entries: WheelListEntry[] }[] {
  return players
    .filter((p) => p.checked)
    .map((player) => {
      let entries = player.list.filter((e) => !skipped.has(e.courseId));
      if (settings.courseLimit > 0) {
        entries = entries.slice(0, settings.courseLimit);
      }
      return { player, entries };
    })
    .filter((x) => x.entries.length > 0);
}

/** Raw (pre-merge) eligible row count — the "N courses" badge. */
export function eligibleCount(
  players: WheelPlayer[],
  settings: WheelSettings,
  skipped: ReadonlySet<string>
): number {
  return eligibleByPlayer(players, settings, skipped).reduce(
    (n, x) => n + x.entries.length,
    0
  );
}

/** The combined wheel slices with their real pick probabilities. */
export function buildWheel(
  players: WheelPlayer[],
  settings: WheelSettings,
  skipped: ReadonlySet<string>,
  mode: WheelMode
): WheelEntry[] {
  const groups = eligibleByPlayer(players, settings, skipped);
  const byCourse = new Map<string, WheelEntry>();
  // "Weighted by person": every playing player gets an equal share of the
  // wheel; within a share, their courses split it by tally weight.
  const playerShare = groups.length > 0 ? 1 / groups.length : 0;

  for (const { player, entries } of groups) {
    const playerWeightSum = entries.reduce(
      (sum, e) => sum + tallyWeight(e.tally, settings),
      0
    );
    for (const e of entries) {
      let slice = byCourse.get(e.courseId);
      if (!slice) {
        slice = {
          courseId: e.courseId,
          courseName: e.courseName,
          suggesters: [],
          entryIds: [],
          totalTally: 0,
          probability: 0,
        };
        byCourse.set(e.courseId, slice);
      }
      slice.suggesters.push({ playerId: player.id, name: player.name });
      slice.entryIds.push(e.entryId);
      slice.totalTally += e.tally;
      if (mode === "byPlayer") {
        slice.probability +=
          (playerShare * tallyWeight(e.tally, settings)) / playerWeightSum;
      }
    }
  }

  const slices = Array.from(byCourse.values());
  if (mode === "equal") {
    // Combined slices weigh by the SUMMED tally (old-app parity).
    const weights = slices.map((s) => tallyWeight(s.totalTally, settings));
    const total = weights.reduce((a, b) => a + b, 0);
    slices.forEach((s, i) => (s.probability = total > 0 ? weights[i] / total : 0));
  }
  return slices;
}

/** Weighted random pick; `rand` is injectable for tests. */
export function pickSlice(
  slices: WheelEntry[],
  rand: number = Math.random()
): number {
  let cumulative = 0;
  for (let i = 0; i < slices.length; i++) {
    cumulative += slices[i].probability;
    if (rand < cumulative) return i;
  }
  return slices.length - 1;
}

export type SliceArc = { start: number; end: number };

/**
 * Slice arcs in degrees, clockwise from 12 o'clock (where the pointer sits).
 */
export function sliceArcs(slices: WheelEntry[]): SliceArc[] {
  const arcs: SliceArc[] = [];
  let at = 0;
  for (const s of slices) {
    const sweep = s.probability * 360;
    arcs.push({ start: at, end: at + sweep });
    at += sweep;
  }
  return arcs;
}

/**
 * Final wheel rotation (degrees, clockwise) that parks a random point inside
 * the winning slice under the pointer, after `turns` full revolutions from
 * `fromRotation`. The landing point stays clear of the slice edges so it
 * never looks like a coin-flip between neighbors.
 */
export function landingRotation(
  arc: SliceArc,
  fromRotation: number,
  turns: number,
  rand: number = Math.random()
): number {
  const sweep = arc.end - arc.start;
  const margin = Math.min(sweep * 0.2, 4);
  const target = arc.start + margin + rand * Math.max(sweep - 2 * margin, 0);
  // Rotating the wheel clockwise by R moves wheel-angle `target` to the
  // pointer when (target + R) ≡ 0 (mod 360).
  const base = fromRotation - (((fromRotation % 360) + 360) % 360);
  let to = base + turns * 360 + ((360 - target) % 360);
  if (to - fromRotation < turns * 360) to += 360;
  return to;
}

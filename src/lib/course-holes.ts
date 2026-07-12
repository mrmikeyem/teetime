import "server-only";
import {
  GENERATED_COURSES,
  type CourseHoleData,
  type HoleData,
} from "./course-hole-data.generated";

// Lincoln Park is Brett's manual table (docs/course-data/lincoln-park.md)
// — the course isn't mapped in OSM, so the generator can't own it.
const LINCOLN_PARK: CourseHoleData = {
  key: "lincoln-park",
  name: "Lincoln Park",
  aliases: ["lincoln park", "lincoln"],
  holes: [
    { hole: 1, bearingDeg: 0, par: 4, lengthYd: null },
    { hole: 2, bearingDeg: 180, par: 4, lengthYd: null },
    { hole: 3, bearingDeg: 0, par: 4, lengthYd: null },
    { hole: 4, bearingDeg: 100, par: 3, lengthYd: null },
    {
      hole: 5,
      bearingDeg: 180,
      par: 4,
      lengthYd: null,
      segments: [
        { bearingDeg: 180, lengthYd: 0 },
        { bearingDeg: 202, lengthYd: 0 },
      ],
    },
    { hole: 6, bearingDeg: 270, par: 4, lengthYd: null },
    { hole: 7, bearingDeg: 0, par: 5, lengthYd: null },
    { hole: 8, bearingDeg: 180, par: 5, lengthYd: null },
    { hole: 9, bearingDeg: 100, par: 3, lengthYd: null },
  ],
};

const ALL_COURSES: CourseHoleData[] = [...GENERATED_COURSES, LINCOLN_PARK];

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Match a free-text TeeTime.course value to a known course, or null. */
export function findCourseHoles(courseName: string): CourseHoleData | null {
  const norm = normalize(courseName);
  if (!norm) return null;
  // Longest alias first so "lincoln park" wins over a hypothetical
  // shorter alias colliding inside the same input.
  const candidates = ALL_COURSES.flatMap((c) =>
    c.aliases.map((a) => ({ course: c, alias: normalize(a) }))
  ).sort((a, b) => b.alias.length - a.alias.length);
  for (const { course, alias } of candidates) {
    if (norm.includes(alias)) return course;
  }
  return null;
}

type WindRelation =
  | "headwind"
  | "tailwind"
  | "cross from the left"
  | "cross from the right";

// windFromDeg is meteorological (direction the wind blows FROM).
// delta 0 = wind straight down the hole into the player's face.
function relation(bearingDeg: number, windFromDeg: number): WindRelation {
  const delta = ((windFromDeg - bearingDeg + 540) % 360) - 180;
  if (Math.abs(delta) <= 45) return "headwind";
  if (Math.abs(delta) >= 135) return "tailwind";
  return delta > 0 ? "cross from the right" : "cross from the left";
}

function holeLabel(h: HoleData): string {
  const bits = [h.par ? `par ${h.par}` : null, h.lengthYd ? `${h.lengthYd}yd` : null]
    .filter(Boolean)
    .join(", ");
  return bits ? `${h.hole} (${bits})` : `${h.hole}`;
}

/**
 * Compact hole-vs-wind block for the summarizer prompt, or null when the
 * wind is too light for hole directions to matter (< 8 mph all round).
 */
export function buildHoleWindBlock(opts: {
  course: CourseHoleData;
  windFromDeg: number;
  windMph: number;
  gustsMph: number;
  hours: { windDirDeg: number; windMph: number }[];
  expectedHoles: number;
}): string | null {
  const { course, windFromDeg, windMph, gustsMph, hours, expectedHoles } = opts;
  if (Math.max(windMph, ...hours.map((h) => h.windMph)) < 8) return null;

  const groups = new Map<WindRelation, HoleData[]>();
  for (const h of course.holes) {
    const rel = relation(h.bearingDeg, windFromDeg);
    groups.set(rel, [...(groups.get(rel) ?? []), h]);
  }

  const lines: string[] = [];
  lines.push(
    `Hole directions — ${course.name}, ${course.holes.length} holes (bearings are direction of play):`
  );
  lines.push(
    `Relative to the tee-off wind (${windMph}mph from ${windFromDeg}°, gusts ${gustsMph}mph):`
  );
  for (const rel of [
    "headwind",
    "tailwind",
    "cross from the left",
    "cross from the right",
  ] as const) {
    const hs = groups.get(rel);
    if (hs?.length) {
      lines.push(`- ${rel}: holes ${hs.map(holeLabel).join(", ")}`);
    }
  }

  // Doglegs whose wind relation flips between the first and last leg.
  const flips = course.holes.filter((h) => {
    if (!h.segments || h.segments.length < 2) return false;
    const first = relation(h.segments[0].bearingDeg, windFromDeg);
    const last = relation(h.segments[h.segments.length - 1].bearingDeg, windFromDeg);
    return first !== last;
  });
  for (const h of flips) {
    const segs = h.segments!;
    lines.push(
      `- dogleg ${h.hole}: starts ${relation(segs[0].bearingDeg, windFromDeg)}, finishes ${relation(segs[segs.length - 1].bearingDeg, windFromDeg)}`
    );
  }

  // Flag a meaningful direction change during the window — the relations
  // above are tee-off-wind only.
  const maxShift = Math.max(
    ...hours.map((h) =>
      Math.abs(((h.windDirDeg - windFromDeg + 540) % 360) - 180)
    )
  );
  if (maxShift > 45) {
    lines.push(
      `- note: wind direction shifts up to ${Math.round(maxShift)}° during the round; the groups above reflect tee-off only`
    );
  }
  if (expectedHoles < course.holes.length) {
    lines.push(
      `- note: only ~${expectedHoles} holes expected this round (starting from 1)`
    );
  }
  return lines.join("\n");
}

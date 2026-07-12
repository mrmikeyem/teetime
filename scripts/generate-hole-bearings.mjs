// Generate per-hole bearing tables in docs/course-data/*.md from
// OpenStreetMap golf=hole ways (drawn tee→green in play direction).
//
//   node scripts/generate-hole-bearings.mjs
//
// Rewrites everything from "## Bearings" down in each target file,
// preserving the hand-written header above it. King's Walk and Lincoln
// Park are deliberately NOT targets — those tables are Brett's manual
// work (kings-walk.md carries an OSM cross-check note instead; Lincoln
// isn't mapped in OSM at all). Data © OpenStreetMap contributors, ODbL.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "docs", "course-data");

// Course centers from OSM leisure=golf_course polygons. A hole way is
// assigned to the nearest center within MATCH_KM.
const COURSES = [
  { file: "valley-golf-course.md", name: "Valley Golf Course", lat: 47.9506, lon: -97.044 },
  { file: "grand-forks-country-club.md", name: "Grand Forks Country Club", lat: 47.8495, lon: -97.004 },
  { file: "minakwa.md", name: "Minakwa Golf Course", lat: 47.7868, lon: -96.6186 },
  { file: "mayville.md", name: "Mayville Golf Club", lat: 47.5053, lon: -97.348 },
  { file: "goose-river.md", name: "Goose River Golf Club", lat: 47.4129, lon: -97.0674 },
  { file: "edgewood.md", name: "Edgewood Golf Course", lat: 46.9293, lon: -96.7669 },
  { file: "sandhill-river.md", name: "Sand Hill Golf Course", lat: 47.5269, lon: -96.2876 },
];
const MATCH_KM = 2.5;
const REGION = { lat: 47.9253, lon: -97.0329, radiusM: 130000 }; // Grand Forks + 130km
const DOGLEG_MIN_TURN_DEG = 15;

const ENDPOINTS = [
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass-api.de/api/interpreter",
];

const WINDS = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
const compass = (deg) => WINDS[Math.round(deg / 22.5) % 16];

function bearing(a, b) {
  const p1 = (a.lat * Math.PI) / 180, p2 = (b.lat * Math.PI) / 180;
  const dl = ((b.lon - a.lon) * Math.PI) / 180;
  const x = Math.sin(dl) * Math.cos(p2);
  const y = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360;
}

function meters(a, b) {
  const R = 6371000;
  const p1 = (a.lat * Math.PI) / 180, p2 = (b.lat * Math.PI) / 180;
  const dp = p2 - p1, dl = ((b.lon - a.lon) * Math.PI) / 180;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const km = (a, b) => meters(a, b) / 1000;
const yards = (m) => Math.round(m * 1.09361);
const signedTurn = (from, to) => ((to - from + 540) % 360) - 180;

async function fetchHoles() {
  const query = `[out:json][timeout:90];way["golf"="hole"](around:${REGION.radiusM},${REGION.lat},${REGION.lon});out tags geom;`;
  let lastErr;
  for (const url of ENDPOINTS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "User-Agent": "teetimes-course-data/1.0" },
        body: new URLSearchParams({ data: query }),
      });
      if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
      return (await res.json()).elements;
    } catch (err) {
      lastErr = err;
      console.error(`overpass endpoint failed, trying next: ${err.message}`);
    }
  }
  throw lastErr;
}

function analyzeHole(way) {
  const g = way.geometry;
  const segs = [];
  for (let i = 0; i < g.length - 1; i++) {
    segs.push({ bearing: bearing(g[i], g[i + 1]), meters: meters(g[i], g[i + 1]) });
  }
  const turns = segs.slice(1).map((s, i) => signedTurn(segs[i].bearing, s.bearing));
  const maxTurn = turns.reduce((m, t) => (Math.abs(t) > Math.abs(m) ? t : m), 0);
  return {
    ref: Number(way.tags.ref ?? 0),
    par: way.tags.par ?? "?",
    overall: bearing(g[0], g.at(-1)),
    lengthYd: yards(segs.reduce((sum, s) => sum + s.meters, 0)),
    segs,
    dogleg: Math.abs(maxTurn) >= DOGLEG_MIN_TURN_DEG ? maxTurn : null,
    osmId: way.id,
  };
}

function renderSections(course, holes, today) {
  const rows = holes.map((h) => {
    const notes = h.dogleg
      ? `Dogleg ${h.dogleg > 0 ? "right" : "left"} — see Doglegs`
      : "";
    return `| ${h.ref} | ${Math.round(h.overall)} | ${compass(h.overall)} | ${h.par} | ${h.lengthYd} | ${notes} |`;
  });
  const pars = holes.map((h) => Number(h.par)).filter(Number.isFinite);
  const parLine =
    pars.length === holes.length
      ? `\nPar total: **${pars.reduce((a, b) => a + b, 0)}**.\n`
      : "";

  const doglegHoles = holes.filter((h) => h.dogleg);
  const doglegSection = doglegHoles.length
    ? doglegHoles
        .map((h) => {
          const segs = h.segs
            .map((s) => `${Math.round(s.bearing)}° (${compass(s.bearing)}, ${yards(s.meters)} yd)`)
            .join(" → ");
          return `| ${h.ref} | ${segs} | ${h.dogleg > 0 ? "Right" : "Left"} |`;
        })
        .join("\n")
    : "";

  return `## Bearings

Auto-generated from OpenStreetMap \`golf=hole\` ways by
\`scripts/generate-hole-bearings.mjs\` on ${today}. Bearings are degrees
clockwise from true north (0° = N, 90° = E). Overall bearing is the
straight tee→green line; lengths follow the mapped centerline. Re-run the
script to refresh. Do not hand-edit below this heading.

| Hole | Bearing (°) | Compass | Par | Length (yd) | Notes |
|-----:|------------:|---------|----:|------------:|-------|
${rows.join("\n")}
${parLine}
## Doglegs

${
  doglegHoles.length
    ? `Segment bearings tee → corner(s) → green for holes turning ≥${DOGLEG_MIN_TURN_DEG}°.

| Hole | Segments | Turn |
|-----:|----------|------|
${doglegSection}`
    : `_None mapped — no hole turns ≥${DOGLEG_MIN_TURN_DEG}° in the OSM geometry._`
}

## Source

OpenStreetMap \`golf=hole\` ways (© OpenStreetMap contributors, ODbL),
retrieved ${today} via Overpass. Way ids: ${holes.map((h) => h.osmId).join(", ")}.
Hole ways are drawn tee → green in direction of play; doglegs appear as
intermediate nodes. Fix errors in OSM itself, then re-run the generator.
`;
}

const elements = await fetchHoles();
const today = new Date().toISOString().slice(0, 10);

for (const course of COURSES) {
  const holes = elements
    .filter((e) => e.geometry && km(e.geometry[0], course) <= MATCH_KM)
    .map(analyzeHole)
    .sort((a, b) => a.ref - b.ref);

  if (!holes.length) {
    console.error(`${course.name}: no OSM holes found — skipped`);
    continue;
  }

  const path = join(DATA_DIR, course.file);
  let head = readFileSync(path, "utf8").split(/^## Bearings$/m)[0].trimEnd();
  head = head
    .replace(/^Status:.*$/m, `Status: **auto-generated from OSM** (${today}).`)
    .replace(/^- Holes: TBD$/m, `- Holes: ${holes.length}`);
  writeFileSync(path, `${head}\n\n${renderSections(course, holes, today)}`);
  console.log(`${course.name}: ${holes.length} holes -> ${course.file}`);
}

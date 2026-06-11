# King's Walk — hole bearings

Tee → green bearing per hole, for the future wind/hole weather feature
(item 5c in `docs/BRETT-TODO.md`). Bearings are degrees clockwise from
true north (0° = N, 90° = E, 180° = S, 270° = W).

Source: manual entry by Brett, cross-referenced against a course
screenshot (`kings-walk-google-maps.png` — Google Maps default render,
north up, no hole numbers).

**Reading the screenshot:**
- Darker green = fairway.
- Lighter green = rough / fescue.
- Blue = water hazards.
- Small green dots = tee boxes.
- Greens are not explicitly marked — infer from fairway end opposite
  the tee dot.

Hole identity per-corridor comes from Brett.

## Bearings

Approximate primary bearing tee → green per hole. Doglegs noted in the
Notes column and detailed below the table.

| Hole | Bearing (°) | Compass    | Par | Notes |
|-----:|------------:|------------|----:|-------|
| 1    | 157         | SSE        | 4   | "SSE from tee to green" (ambiguity resolved via #9's parallel-NNW direction) |
| 2    | 157         | SSE        | 4   | Parallels #1 |
| 3    | 270         | W          | 5   | Due west |
| 4    | 0           | N          | 3   | Due north |
| 5    | 100         | ESE        | 4   | Starts east, dogleg right to ESE — see Doglegs |
| 6    | 57          | NE/ENE     | 4   | |
| 7    | 237         | SW/WSW     | 4   | Reverse of #6 |
| 8    | 57          | NE/ENE     | 3   | |
| 9    | 337         | NNW        | 5   | Parallels #1, runs back toward clubhouse |
| 10   | 95          | E (slight S) | 4 | "Straight east, slight south dip" |
| 11   | 112         | ESE        | 4   | |
| 12   | 215         | SW/SSW     | 4   | |
| 13   | 258         | W/WSW      | 3   | |
| 14   | 57          | ENE → NE   | 5   | Doglegs left from ENE to NE — see Doglegs |
| 15   | 247         | WSW        | 4   | |
| 16   | 350         | N (slight NNW) | 3 | |
| 17   | 78          | E/ENE      | 4   | |
| 18   | 282         | W/WNW      | 5   | |

Par total: **72** (front 9: 36 · back 9: 36).

## Doglegs

For doglegs, eventually we'll want **two** bearings (tee → corner, then
corner → green) so the wind effect can flip mid-hole. The single bearing
in the table is the dominant/finishing direction; refine when 5c starts.

| Hole | Tee → corner | Corner → green | Direction |
|-----:|-------------:|---------------:|-----------|
| 5    | ~90 (E)      | ~115 (ESE)     | Right dogleg |
| 14   | ~67 (ENE)    | ~45 (NE)       | Left dogleg |

## Spot-check sign-off (2026-06-11)

Geometry reviewed against the Google Maps screenshot and Brett's verbal
descriptions. Findings:

- Parallel pairs check out exactly: #1↔#9 and #6↔#7 are both 180° apart.
- Front 9 routes out from clubhouse (SSE) and returns (NNW via #9).
- Back 9 starts E from clubhouse (#10) and returns WNW (#18).
- #14 → #15 transition is ~22° off a clean 180°, #17 → #18 is ~24° off
  — fine, tee/green transitions don't need to be opposite.
- No internal contradictions surfaced. Bearings are good enough for 5c
  prompt-level use. If finer accuracy is ever needed (5c v2?), measure
  pixel-bearings from the screenshot per hole.

## Open questions for the data model (decide at 5c time)

- Store per-hole bearing on a `Hole` row, or per-course as an array
  on a `Course` row? Hole row probably wins because it supports doglegs
  cleanly (multiple bearings per hole).
- Tee box matters for bearing (different tees → slightly different
  geometry). Probably negligible for wind-effect purposes — pick one
  representative tee (likely middle/whites) and don't over-engineer.
- Hole length matters too: a 150-yd par 3 vs a 580-yd par 5 with the
  same wind direction read very differently. Store yardage alongside.

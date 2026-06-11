# Course data

Hole bearings and par data for courses the group plays (or might play).
Used by the future weather/wind feature (item 5c in `docs/BRETT-TODO.md`)
and the planning view (item 6).

## Status

| # | Course | Location | Approx. distance | In-app shortcut | Status |
|--:|--------|----------|------------------|:---------------:|--------|
| 1 | [King's Walk](kings-walk.md) | Grand Forks, ND | home | ✓ | **complete** |
| 2 | [Lincoln Park](lincoln-park.md) | Grand Forks, ND | ~3mi | ✓ | **complete** |
| 3 | [Valley Golf Course](valley-golf-course.md) | Grand Forks area | ~5mi | ✓ | not started |
| 4 | [Grand Forks Country Club](grand-forks-country-club.md) | Grand Forks, ND | in town | — | not started · private (guest/event play) |
| 5 | [Minakwa](minakwa.md) | Crookston, MN | ~25mi E | — | not started |
| 6 | [Larimore](larimore.md) | Larimore, ND | ~30mi W | ✓ | not started |
| 7 | [Mayville](mayville.md) | Mayville, ND | ~40mi SW | — | not started |
| 8 | [Goose River](goose-river.md) | Hillsboro, ND | ~40mi S | — | not started |
| 9 | [Edgewood](edgewood.md) | Fargo, ND | ~75mi S | — | not started · outside 40mi |
| 10 | [Sandhill River](sandhill-river.md) | Fertile, MN | ~50mi SE | ✓ (as "Fertile") | not started · slightly outside 40mi but in app |

## Open questions for Brett

- **In-app shortcut `"Fertile"`** — should it stay as-is, get renamed
  to `"Sandhill River"`, or have both as aliases? Decide when 5c lands.
- Any other courses missing? The group's in-app shortcuts list (in
  `src/app/(app)/tee-times/new/new-form.tsx`) is the canonical set; the
  rest above are area courses worth covering for the planning view (item
  6) even if the group hasn't played them yet.

## What to provide per course

For each course, drop into its file (or paste in chat, I'll format):

- [ ] **Holes** — 9 or 18?
- [ ] **Par per hole** + total par.
- [ ] **Tee → green bearing per hole** — compass directions are fine
      ("SSE", "ENE", "due W"), I'll convert to degrees and reconcile.
- [ ] **Doglegs** — which holes, which direction, roughly where the corner is.
- [ ] **Google Maps screenshot** — default render (not satellite), north
      up. Save as `{slug}-google-maps.png` next to the per-course file.

The color legend (darker green = fairway, lighter = rough, green dots =
tee boxes, blue = water) is defined in `kings-walk.md` and applies to
all courses.

## Per-course file format

See `kings-walk.md` for the working reference. Each course gets:
- Source + screenshot pointer
- Bearings table (per hole, tee → green, with par + compass + notes)
- Doglegs subsection (tee → corner, corner → green)
- Spot-check sign-off once verified

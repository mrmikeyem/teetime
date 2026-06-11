# Brett's TODO

Running list of changes Brett wants to make. Free-form; promote items to
`docs/ROADMAP.md` once they become committed initiatives with scope and
sequencing. Drop items here when done (or move to `## Done` if worth
remembering).

Companion to `docs/ROADMAP.md`.

## Open

- **Local dev environment setup.** Currently no `.env.local`, so
  `npm run dev` immediately fails with next-auth `MissingSecret` and
  cascades into `session.user.id` crashes on `/tee-times`. Need at
  minimum:
  - `AUTH_SECRET` — any random 32-byte string locally
    (`openssl rand -base64 32`)
  - `DATABASE_URL` — local Postgres, or prod URL for read-only
  - `ANTHROPIC_API_KEY` — dev key from console.anthropic.com (otherwise
    `summarizeRound` short-circuits and the "What to expect" blurb
    silently never appears)
  - Anything else CLAUDE.md / INFRA.md require
  Unblocks the "smoke test locally before pushing" step in
  CONTRIBUTING.md for every future PR. Do this before the next change
  that needs actual UI verification.

- **GitHub Actions auto-deploy on push to main.** Currently every
  deploy is a manual SSH + `./deploy.sh` on the droplet, which means
  any PR sits "merged but not live" until Brett's at a machine with
  the deploy key. Add a `.github/workflows/deploy.yml` that on push
  to `main`: SSHes to the droplet using a repo deploy key (stored as
  a GitHub Actions secret), runs `./deploy.sh`, and surfaces failures
  back to the run log. ~30 lines of YAML. Removes the SSH-from-this-
  machine friction entirely. Worth a dedicated `chore/auto-deploy` PR.

- **Cache the Claude "what to expect" blurb on a sliding-scale TTL +
  manual refresh.** Today the Open-Meteo forecast fetch in
  `getRoundForecast` is cached 30 min via `next: { revalidate }`, but
  `summarizeRound` hits Anthropic Haiku on every single page render —
  each tee-time view = one paid LLM call even when the forecast under-
  neath hasn't changed.

  Caching design: TTL slides based on how far out the tee-off is, since
  far-out forecasts barely change hour-to-hour but day-of can shift
  fast.
  - **≥7 days out**: cache 24h. (First view costs an Anthropic call;
    re-views for the rest of the day are free.)
  - **3-7 days out**: cache ~6h. (Tunable.)
  - **1-3 days out**: cache 1h.
  - **≤24h out**: cache 30 min. (Matches the underlying Open-Meteo
    revalidation window — the inputs literally can't change faster.)
  - **In-progress / past tee-off**: don't cache aggressively; weather
    is settled.

  UX: show the cache age next to the blurb ("Updated 14 min ago"). If
  the entry is older than ~30 min, show a small "Refresh forecast"
  button that forces a fresh Open-Meteo fetch + Claude call. Cheap
  escape hatch when conditions are changing fast.

  Keying: `(teeTimeId, forecastSnapshotHash)` so an edit to the
  tee-time's tee-off time naturally invalidates. Implementation likely
  `unstable_cache` from `next/cache` with a dynamic `revalidate`, or a
  small DB table keyed by tee-time id with TTL + a `regeneratedAt`
  column for the staleness indicator.

  Wins: cost drop, faster renders, stable blurb wording across
  refreshes (no more LLM-nondeterminism drift), AND control when it
  matters.

- **Pre-existing lint cleanup.** `npm run lint` reports 10 issues on
  `main` (unescaped quotes in 2 files, React purity violations in
  `tee-times/[id]/page.tsx`, setState-in-effect in `countdown.tsx` and
  `member-picker.tsx`, unused var in `sw.js`). Deploy doesn't gate on
  lint, so they've been accumulating. Knock out in a focused
  `chore/lint-cleanup` PR.

- **Google login integration.** Add Google as a next-auth provider
  alongside the existing credentials flow, for easier sign-in and longer
  sustained sessions. Decide how Google identity links to the existing
  invite-only `User` rows (match on email? require existing invite?).

- **Scramble creator.** New feature: enter a number of players (with
  optional handicaps) and generate scramble team assignments using
  several strategies depending on player/team counts. Scope TBD —
  needs a discussion pass before design.

- **Fold in the Golf Course Wheel sim app.** Currently lives at
  `D:\Local Sites\brett-wysocki\app\public\golf` — a PHP + vanilla-JS
  single-page app (LocalWP, v1.7.0) with a spin-the-wheel course picker,
  per-person course lists, play log, GolfCourseAPI integration, 6 SCSS
  themes, and `data.json` flat-file storage. See its own `README.md` and
  `FUTURE_IDEAS.md` for the full feature set.

  Intent: lives on its own inside this app — only the user/identity system
  is shared. Sketch:
  - Route segment: `(app)/sim/` (or similar) hosts wheel, course lists,
    play log, settings.
  - `people[]` → existing `User` rows; non-user players → existing
    `Guest` model.
  - New Prisma models for per-user course lists and the sim play log;
    `courses_cache.json` becomes a DB-backed GolfCourseAPI cache with TTL.
  - Canvas wheel logic ports intact; SortableJS → `@hello-pangea/dnd` or
    `dnd-kit`. Admin PIN → `requireAdmin()`.
  - SCSS theme partials are mature — useful input for item 4's styling
    pass. Decide: port into Tailwind v4 theme tokens vs. keep SCSS
    alongside.

  Cross-feature seam (the only one): future **winter sim tee times** —
  add a `SIM_ROUND` value to `TeeTime.type` and link it to a sim play-log
  row. Not required for the initial fold-in.

- **Styling deep dive — de-AI the look.** Current UI reads as
  generic-AI-generated. Want it to feel hand-crafted: more personality,
  intentional type/spacing/color choices, less default-Tailwind feel.
  Audit pass across the app, then a redesign plan.

- **5a — Weather summary should respect expected play length.**
  `lib/weather-summary.ts` feeds Claude the full forecast through the
  round window without knowing how many holes will actually be played.
  For an evening tee time (e.g. 6:30 with 9:25 sunset → realistically
  9 holes), the blurb still warns about conditions at 9:30 when nobody's
  on the course anymore. Fix: estimate the realistic playable window
  (sunset, pace, hole count) and cap the forecast slice handed to Claude
  — or at least hint it in the prompt. Annoyance, not a bug. **First PR.**

- **5b — Humidity in the weather summary.** Open-Meteo already exposes
  `relative_humidity_2m`. Add it to the `hourly` query in
  `getRoundForecast`, plumb through `HourlyPoint`, format into the user
  message, and mention humidity effects (ball flight in dense/humid air,
  green resiliency / firmness) in the system prompt. Small follow-up PR
  after 5a. Could fold into 5a if appetite, but discipline says split.

- **5c — Wind direction vs hole bearing (per-hole wind effect).** Join
  forecast wind direction against each hole's tee→green bearing so the
  blurb can say things like "front 9 plays into the wind, back 9 with
  it at your back." Bigger than 5a + 5b combined because it needs a
  data model the app doesn't have yet:
  - `Course` and `Hole` as first-class Prisma models (overlaps with
    item 6's planning view, which also wants `Course`).
  - Bearings per hole (degrees from N), plus dogleg corner bearings
    where applicable; tee box and yardage as supporting data.
  - Manual data entry is fine — courses don't change. Brett is starting
    a King's Walk bearings doc at `docs/course-data/kings-walk.md`.
  - Open-Meteo wind direction is already in the forecast; the new work
    is geometry + prompt logic, not weather plumbing.

  Sequencing: sequence after 5a/5b, and either pair with item 6's
  `Course`-model groundwork or be the thing that establishes it.

- **Tee-time planning view (bigger project).** Reservations open one
  week out (King's Walk membership rule), so picking the best day/time
  inside that 7-day window matters. Build a planner that shows the
  upcoming week with weather + course events overlaid so you can pick
  smart before booking. Pieces:
  - Ingest the King's Walk event calendar (tournaments, leagues, course
    closures) and surface them per-day. Source TBD — public ICS, a
    scrape, or manual entry to start.
  - Course selector ("course" concept may need to become a first-class
    Prisma model with its own calendar) so the planner can swap to
    other courses' upcoming-week event feeds in the future.
  - Per-day weather slice across the 7-day window, with the same
    realistic-play-window awareness as the weather-summary item above.
  - UI: a calendar/grid view, not just a list. Probably a new
    `(app)/plan/` route.

  Sequencing: bigger than the others. Likely last, or right before the
  weather tweak (so weather work informs both).

## Done

- _(move completed items here, with the date)_

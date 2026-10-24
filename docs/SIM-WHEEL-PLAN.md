# Sim Wheel fold-in plan

Status: drafted 2026-10-24, **built the same day on `feature/sim-wheel`**
(tested locally against the live data export). Decisions taken with Mike:
Play removes the course from EVERY list; players = tee3golf members + guests
(Lee/Mikey dropped — no courses, no plays); `User.simAccess` (default on,
admin-toggled) gates `/sim`; tallies DO weigh within a player's share in
by-person mode; deletes stay open to every sim user (parity), Manual Play is
admin-only. Prod cutover = merge + `_import-sim-wheel.mjs` against a fresh
`data.json`/`courses_cache.json` export.

Goal: move the winter-simulator **Golf Course Wheel**
(https://brettwysocki.com/golf, PHP + vanilla JS + `data.json`, v1.7.1) into
tee3golf as a first-class section, with **full feature parity**, all data in
Postgres, the existing tee3golf identity/auth, and a modernized spin
experience (new animations). The old app's data migrates over once; after
cutover the old URL redirects here.

Analysis sources: the live app's served `index.html` / `app.js` / `themes.css`
/ `README.md` / `FUTURE_IDEAS.md` / `data.json` / `courses_cache.json`, plus a
read-only click-through of the live UI. **The PHP backend (`index.php`) is not
web-visible** — server-side semantics below marked *(infer)* are deduced from
the client + README and must be confirmed against Brett's source.

---

## 1. What exists today

### 1.1 Data snapshot (live `data.json`, 2026-10-24)

| Thing | Count / value |
|---|---|
| Players ("people") | 6 — Brice (12 courses), Mike (5), Brett (2), Andy (1), Lee (0), Mikey (0). Brice/Mike/Brett checked |
| Course-list entries | 20, each `{name, tally, apiId, location{city,state,country}}`, all API-linked |
| Play log | 19 rounds, 2025-11-11 → 2026-04-14; 16 API-linked, 3 free-text (Jade Dragon, Pleasant Valley, Augusta) |
| Distinct courses (lists + log) | 38 (35 API ids) |
| `courses_cache.json` | 51 GolfCourseAPI course payloads, 1.9 MB (full tee sets incl. per-hole par/yardage/handicap) |
| Settings | courseLimit **5**, tallyEnabled **true**, tallyMode **multiplier**, tallyMultiplier **1.5** |

Current tallies are high (Hawktree 9 → weight 1.5⁹ ≈ 38 vs. 1 for a fresh
course), which is why the wheel is dominated by a few slices right now. That is
the intended design, just worth knowing.

The season is off right now (last play 2026-04-14), so the data isn't
changing. **This is the ideal migration window** — land it before the first
winter sim night.

### 1.2 Feature inventory (the parity checklist)

**Wheel & spin**
- Canvas wheel, slices = eligible courses from **checked** players.
- Same-named course on multiple players' lists → **one combined slice**;
  "suggested by" lists all of them; tallies summed.
- Course count badge (counts raw per-player entries, pre-merge).
- **Courses Per Player** limit: only the top N of each list by drag order
  (0/1/2/3/5/10). Applied *after* removing session-skipped courses, so a skip
  promotes the next course into the top N.
- **Wheel Mode** toggle: *Equal slices* vs *Weighted by person* (pick random
  checked player first, then a random course of theirs). **Session-only, not
  saved.**
- **Tally weighting** (saved): weight = 1 (off), `1 + tally` (additive), or
  `multiplier ^ tally` (multiplier, 1.1–3.0). Slice size ∝ weight.
- Spin: winner chosen up front (weighted random), wheel animates 5 turns +
  offset to the **exact middle** of the winner's slice, 4s cubic ease-out.
- Result modal: course, suggested by, **Last played <date>** (if in log);
  buttons **Play This Course / Skip / Cancel**.
  - **Skip**: if tallies on → +1 tally to every *other* (player, course) on the
    wheel; course hidden for the rest of the session.
  - **Cancel**: closes, no side effects.
  - **Play**: → tee-selection modal → if tallies on, +1 to every other course
    → log the play (players = all checked players' names) → course hidden for
    the session → *(infer)* course removed from players' lists ("removes from
    lists" per README — confirm whether from all lists or only the suggesters').
- **Reset Session**: clears session skips.

**Tee selection** (on Play, Manual Play, and play-log edit)
- API-linked course → dropdown of all men's + women's tees with
  rating/slope/yards; stores `{name, rating, slope, yards}`.
- Unlinked → free-text tee name. Tee is optional.

**Players & course lists**
- Add player (name). Delete player — type `DELETE` to confirm (button hidden
  while the player is checked). Check/uncheck (saved, shared).
- Per-player collapsible course list: drag to reorder (SortableJS), add course
  (free text or via 🔍 search modal → "Use Selected" / "Use As Typed"),
  delete course (✕, **no confirm**), location line, ℹ️ course info (linked) or
  🔗 link-to-database (unlinked).
- Tally badge per course when tallies on; **Adjust Tallies** (session-only
  toggle) swaps badges for −/+ buttons. **Reset All Tallies** (confirm).

**GolfCourseAPI** (golfcourseapi.com, key held server-side in PHP)
- Search by name (≥2 chars), results show club – course + location, ℹ️ preview.
- **Link (enrich)** a list course or a play-log entry to an API course
  (renames to the API display name, stores apiId + location).
- Course info modal: name, location, holes/par, tees table with Men/Women
  toggle.
- Course details cached locally (`courses_cache.json`, `cached_at`).

**Play log**
- Newest first; shows 5 with "Show All (N)" / "Show Less"; search across
  course/suggester/players/comment (searching shows all matches).
- Card: course + ℹ️/🔗, color-coded tee badge (gold/blue/white/black/red/
  green/silver/orange by keyword), location, suggested by, players, comment,
  date pill (date-only for "Manual Entry" rows).
- Edit modal (✏️, or click card on hover-capable devices): course (+ 🔍 relink
  / unlink), suggested by, players, tees (dropdown or text), date, time (CT),
  notes. Delete from edit modal with a random 6-char code confirm.
- **Add Manual Entry** (collapsible form): course, suggested by, players
  (comma-separated), date.

**Manual Play (Admin)**: 4-digit hardcoded PIN → list of eligible wheel
entries → pick one → same tee-selection + logging path as a spin (including
tally increments).

**Themes**: 6 themes (Classic Green, Dark Luxe, Retro Scorecard, Neon Night,
Links Coastal, Masters) — ~72 CSS custom properties each, 12 wheel slice
colors each, 12 Google font families; choice stored in `localStorage`.

**Layout**: two-column ≥900px with sticky wheel; single column on mobile.

### 1.3 Bugs and problems found (fix during the port, don't port them)

1. **Manual Entry is broken in prod.** The "Add to Log" button calls
   `submitManualEntry()`, which doesn't exist (the function is
   `addManualLog()`). Its course autocomplete dropdown is never wired either.
2. **Dead UI**: the Comment modal (`saveComment()`) doesn't exist; the
   `updateComment` endpoint is unused (comments edit via the edit modal).
3. **Data is public.** `https://brettwysocki.com/golf/data.json` and
   `courses_cache.json` are directly downloadable, and the POST API has no
   auth at all — anyone with the URL can add/delete players or wipe the log.
   The admin PIN only gates a UI flow. → **Brett should block direct access to
   the JSON files now**, independent of this project.
4. **Edit-modal date shift**: the date field uses `toISOString()` (UTC), so a
   round logged after 7pm CT shows the *next* day and saving moves it.
5. **Weighted-by-person mode lies visually**: slices are still drawn by course
   weight, but the pick is player-then-course and **ignores tallies**. The
   wheel lands on the right slice, but the odds don't match what's drawn.
6. **Mixed date formats** in the log (`2026-04-14 17:36:11` vs
   `2026-01-27T17:30:00`), both naive Central wall time; the browser parses
   them as *its own* local time.
7. "Manual Entry" is stored as a fake suggester name; multi-suggester rows
   store `"Brice, Mike"` as one string; players are a comma string.
8. Combined slices and "last played" match on **exact / case-folded name**, so
   a renamed or slightly different spelling splits history.
9. Spin always lands dead-center of the slice (feels canned).
10. Deleting a course has no confirm (tee3golf rule: destructive actions
    confirm — see ARCHITECTURE "Client patterns").

---

## 2. Target design in tee3golf

### 2.1 Placement

- Route segment **`(app)/sim/`** — `/sim` is the hub (wheel + players +
  play log, same two-column layout). Add `"/sim/:path*"` to `middleware.ts`.
- Nav: `🏌️ Sim` link in `HeaderMenu` (between Events and Teams).
- REST API under **`/api/sim/*`** (singular resources, JSON, session auth).
- Libs: `src/lib/sim-wheel.ts` (pure, client-safe: eligibility, combining,
  weights, pick, slice geometry — shared by server and client so the odds
  logic exists once), `src/lib/golf-course-api.ts` (server-only API client +
  DB cache), `src/lib/sim-actions.ts` (server-only mutation cores, like
  `tee-time-actions.ts`).
- Lives on its own: only identity (User/Guest) is shared with tee times.

### 2.2 Data model (Prisma, snake_case maps, uuid ids per conventions)

```prisma
enum SimTallyMode {
  ADDITIVE
  MULTIPLIER
  @@map("sim_tally_mode")
}

// Canonical course — one row per real course, shared by lists and the log.
// Replaces name-matching: combined slices + "last played" key on this id.
model SimCourse {
  id        String   @id @default(uuid()) @db.Uuid
  name      String                       // display name (API "club - course" or as typed)
  apiId     Int?     @unique @map("api_id")
  city      String?
  state     String?
  country   String?
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  listEntries SimListEntry[]
  plays       SimPlay[]
  @@map("sim_courses")
}

// A wheel participant. Exactly one of userId/guestId (CHECK constraint,
// same pattern as TeeTimeMember) — Lee/Mikey may not be tee3golf users.
model SimPlayer {
  id        String   @id @default(uuid()) @db.Uuid
  userId    String?  @unique @map("user_id") @db.Uuid
  guestId   String?  @unique @map("guest_id") @db.Uuid
  checked   Boolean  @default(false)     // "at the sim tonight" — shared state
  seq       Int      @default(0)
  createdAt DateTime @default(now()) @map("created_at")

  user    User?  @relation(fields: [userId], references: [id], onDelete: Cascade)
  guest   Guest? @relation(fields: [guestId], references: [id], onDelete: Cascade)
  list    SimListEntry[]
  plays   SimPlayPlayer[]
  @@map("sim_players")
}

// One course on one player's list. position = drag order; tally per entry.
model SimListEntry {
  id        String   @id @default(uuid()) @db.Uuid
  playerId  String   @map("player_id") @db.Uuid
  courseId  String   @map("course_id") @db.Uuid
  position  Int
  tally     Int      @default(0)
  createdAt DateTime @default(now()) @map("created_at")

  player SimPlayer @relation(fields: [playerId], references: [id], onDelete: Cascade)
  course SimCourse @relation(fields: [courseId], references: [id], onDelete: Cascade)
  @@unique([playerId, courseId])
  @@index([playerId, position])
  @@map("sim_list_entries")
}

model SimPlay {
  id         String    @id @default(uuid()) @db.Uuid
  courseId   String    @map("course_id") @db.Uuid
  playedAt   DateTime  @map("played_at")          // UTC; display CT
  dateOnly   Boolean   @default(false) @map("date_only") // replaces the "Manual Entry" hack
  source     String    @default("wheel")          // wheel | manual_play | manual_entry | import
  teeName    String?   @map("tee_name")
  teeRating  Decimal?  @db.Decimal(4, 1) @map("tee_rating")
  teeSlope   Int?      @map("tee_slope")
  teeYards   Int?      @map("tee_yards")
  comment    String?
  loggedBy   String?   @map("logged_by") @db.Uuid  // audit (new)
  legacyId   String?   @unique @map("legacy_id")  // data.json id — makes the import idempotent
  createdAt  DateTime  @default(now()) @map("created_at")
  updatedAt  DateTime  @updatedAt @map("updated_at")

  course  SimCourse       @relation(fields: [courseId], references: [id])
  players SimPlayPlayer[]
  @@index([playedAt])
  @@map("sim_plays")
}

// Who played + who suggested (multi-suggester when a combined slice wins).
model SimPlayPlayer {
  playId    String  @map("play_id") @db.Uuid
  playerId  String  @map("player_id") @db.Uuid
  played    Boolean @default(true)
  suggested Boolean @default(false)

  play   SimPlay   @relation(fields: [playId], references: [id], onDelete: Cascade)
  player SimPlayer @relation(fields: [playerId], references: [id])
  @@id([playId, playerId])
  @@map("sim_play_players")
}

// Singleton (id = 1) — shared group settings, like data.json "settings".
model SimSettings {
  id              Int          @id @default(1)
  courseLimit     Int          @default(0) @map("course_limit")
  tallyEnabled    Boolean      @default(false) @map("tally_enabled")
  tallyMode       SimTallyMode @default(ADDITIVE) @map("tally_mode")
  tallyMultiplier Decimal      @default(1.5) @db.Decimal(3, 1) @map("tally_multiplier")
  updatedAt       DateTime     @updatedAt @map("updated_at")
  @@map("sim_settings")
}

// GolfCourseAPI response cache (replaces courses_cache.json).
model GolfCourseCache {
  apiId     Int      @id @map("api_id")
  payload   Json                       // full course incl. tees.male/female + holes
  fetchedAt DateTime @default(now()) @map("fetched_at")
  @@map("golf_course_cache")
}
```

Notes / decisions baked in:
- **Removing a player from the log**: `SimPlayPlayer.player` has no cascade —
  deleting a SimPlayer who has history must be blocked or soft (archive flag)
  so the log keeps names. Proposal: add `archivedAt` and make "Delete" archive
  when history exists, hard-delete otherwise.
- Free-text players/suggesters that don't map to a SimPlayer: none in the
  current data (all names are among the 6), so no free-text fallback column is
  needed. "Manual Entry" rows → `source = "import"`/`manual_entry`,
  `dateOnly = true`, no suggester.
- Tee gender isn't stored today; keep parity (name/rating/slope/yards).
- Cache TTL: course data rarely changes → 90 days, refetch on miss/expiry.
- Session-only state stays client-side for parity: **skipped courses**,
  **Wheel Mode**, **Adjust Tallies** (in `sessionStorage`, so a refresh no
  longer loses skips — small upgrade).
- Theme: per-user, `User.simTheme String?` (today it's per-browser
  `localStorage`; storing it on the user follows you across devices).

### 2.3 API (`/api/sim/*`, session-authed; every mutation → `broadcastChange()`)

| Old action | New endpoint |
|---|---|
| getData | server-rendered page (no GET needed, same as the bell) |
| addPerson / deletePerson / togglePerson / reset | `POST /api/sim/players`, `DELETE|PATCH /api/sim/players/[id]` |
| addCourse / deleteCourse / reorderCourses | `POST /api/sim/players/[id]/courses`, `DELETE …/courses/[entryId]`, `PUT …/courses/order` |
| adjustTally / resetTallies | `PATCH …/courses/[entryId]` `{tallyDelta}`, `POST /api/sim/tallies/reset` |
| incrementTallies + playCourse | **one transaction**: `POST /api/sim/spin/play` `{courseId, suggesterIds, wheelEntryIds, tee}` |
| (skip) incrementTallies | `POST /api/sim/spin/skip` `{courseId, wheelEntryIds}` |
| manualLog / updatePlayLog / updateComment / deletePlayLog / enrichPlayLog | `POST /api/sim/plays`, `PATCH|DELETE /api/sim/plays/[id]` |
| saveSettings | `PATCH /api/sim/settings` |
| searchCourses / getCourseDetails | `GET /api/sim/courses/search?q=`, `GET /api/sim/courses/[apiId]` (cached) |
| enrichCourse / bulkEnrichCourses | `POST /api/sim/courses/[id]/link` `{apiId}` (links the canonical course — fixes every list + log row at once) |
| validatePin | gone → `isAdmin()` |

Play/skip become single server transactions (today the client fires
`incrementTallies` then `playCourse` as two requests — a dropped second request
leaves tallies bumped with no log row). The server **recomputes** the
eligible set from `wheelEntryIds` rather than trusting client tally math.

### 2.4 Permissions

Parity is "anyone at the sim can do anything." Proposal:
- Any signed-in member: spin, play/skip, check players, add/reorder/delete
  courses on any list, tallies, settings, log/edit plays.
- **Admin only**: Manual Play (replaces the PIN), delete/archive a player,
  delete a play-log entry (keep the code-confirm UX too).
- `EVENT`-role users: hide `/sim` (they're weekend-only guests) — decision for
  Mike/Brett.

### 2.5 Real-time

The page mounts the existing `AutoRefresh` (SSE → `router.refresh()`), so a
phone and the sim-room TV stay in sync. **Guard:** the wheel component must
freeze its server props while a spin animation is running and apply the
refresh after it settles, or a refresh mid-spin will redraw the slices under
the pointer.

Optional later (not parity): *shared spin* — the server picks the winner and
broadcasts it so every open screen plays the same spin at once.

### 2.6 Notifications

None today, none required for parity. Optional: an in-app feed row ("Brett
logged Spyglass Hill — Blue 73.3/140") via a new `notifySimPlayLogged` in
`notification-events.ts` (never at the call site — CLAUDE.md rule).

---

## 3. Modernized spin experience

No animation library in the repo today (one CSS keyframe in `globals.css`).
Proposed stack (pin exact versions when adding):
- **`motion`** (Motion for React, ex-framer-motion) — springs, `AnimatePresence`
  for modals/sheets, `layout` animations for lists/play log.
- **`@dnd-kit/core` + `@dnd-kit/sortable`** — replaces SortableJS (touch-
  friendly, keyboard accessible, animates reorder).
- **`canvas-confetti`** (~6 KB) — win burst. (Or hand-roll; it's small.)

Wheel rendering: **SVG** instead of canvas — crisp at any DPR, slice colors
straight from theme CSS variables, real text (accessible), and slice paths can
be tweened.

Spin choreography (respects `prefers-reduced-motion` → instant result card):
1. **Wind-up** — short backward pull (~150ms) on press.
2. **Launch** — fast spin, ~5–7 turns, with slight motion blur on the label
   layer.
3. **Decelerate** — custom ease-out-quart into the target, landing at a
   **random point inside the winner's slice** (not dead-center), with a tiny
   overshoot-and-settle.
4. **Pointer ticker** — the pointer flicks on each slice boundary it passes
   (spring), with optional tick sound (Web Audio, mute toggle) and
   `navigator.vibrate` tick on Android.
5. **Win** — winning slice lifts/glows, others dim; confetti in theme colors;
   result card springs up (bottom sheet on mobile, centered card on desktop)
   with "Last played …", tally, suggested-by avatars.
6. **Live wheel** — when players are checked/unchecked, tallies change, or a
   course is skipped, slices **morph** to their new angles instead of
   snapping; skipped course shrinks out.
7. Play log: new row slides in at the top; list reorder animates (dnd-kit +
   `layout`).

Also fix the weighted-by-person honesty bug: in that mode compute each
entry's true probability (player share × within-player weight) and **draw the
slices at those probabilities**, so the wheel always shows the real odds.
Decision: should tallies apply within a player's share in that mode? (Today
they don't.) Recommend yes.

Themes: port the 6 themes as scoped CSS variables on the `/sim` container
(`data-sim-theme="dark-luxe"` etc.) — the compiled `themes.css` already holds
every token, so this is mostly mechanical. Load the theme fonts with
`next/font/google` **only on `/sim`** (12 families today — trim to the ones
each theme actually uses). The app-wide light/dark mode stays as-is outside
the hub; inside the hub, the sim theme wins (Classic Green gets a dark variant
so dark-mode users aren't flash-banged).

---

## 4. Data migration

One-off script `_import-sim-wheel.mjs` (repo-root `_*.mjs` pattern, deleted
after use):
1. Input: `data.json` + `courses_cache.json` fetched fresh at cutover.
2. `--dry-run` prints the full mapping and counts; real run is one
   transaction, idempotent via `SimPlay.legacyId` + course `apiId`/name upserts.
3. Courses: upsert `SimCourse` by `apiId`, else by case-folded name.
4. Players: map by an explicit table, confirmed with Mike/Brett first:

   | Wheel name | tee3golf identity |
   |---|---|
   | Brice | User Brice Welch |
   | Mike | User Mike Yem |
   | Brett | User Brett Wysocki |
   | Andy | User Andy Daily |
   | Lee | ? (not a member — EVENT invite, or Guest) |
   | Mikey | ? (who is this vs. "Mike"?) |

5. List entries with `position` = array order, `tally` as-is; `checked` as-is.
6. Plays: parse dates as **America/Chicago wall time** → UTC
   (`appTzWallTimeToUtc` in `lib/time.ts`); "Manual Entry" → `dateOnly`,
   `source=import`, no suggester; split `players`/`person` strings into
   `SimPlayPlayer` rows; tee object → tee columns (string tees → `teeName`).
7. Cache: load all 51 payloads into `GolfCourseCache` (`fetchedAt` =
   `cached_at`).
8. Settings → `SimSettings` row.
9. Verify: counts (6 / 20 / 19 / 38 / 51), spot-check a few plays' CT times
   and tees on the new page, compare wheel slices side by side.

Cutover: final import → announce via `/admin/announcements` (bell + email,
"the wheel moved") → Brett redirects `brettwysocki.com/golf` →
`https://tee3golf.com/sim` (or makes it read-only) so nobody keeps writing to
the old copy.

Needed from Brett:
- `index.php` source (confirm play removes from **which** lists; skip/play
  tally edge cases; search response normalization; rename-on-link behavior).
- The **GolfCourseAPI key** (→ `GOLFCOURSE_API_KEY` in prod `.env`, and
  `.env.example`) and its plan limits.

---

## 5. Delivery plan (PRs, each must `npm run build` + lint clean)

1. **Schema + import** — models above + migration (prod migration via the
   documented `migrate diff` path, `pg_dump` first), `golf-course-api.ts` +
   cache, import script dry-run against local with the live JSON.
2. **Read-only hub** — `/sim` page, nav link, middleware: static SVG wheel,
   players + lists, play log (search, show-all, tee badges), course info
   modal. Lets everyone eyeball migrated data.
3. **Management** — players, courses (search / as-typed / link / reorder /
   delete with confirm), tallies (badges, adjust, reset), settings, play log
   CRUD (edit modal with relink + tee picker, manual entry that works, delete
   with code confirm). `broadcastChange()` everywhere.
4. **Spin** — `sim-wheel.ts` odds engine, spin choreography, result card,
   skip / play / cancel, tee selection, session skips + Reset Session, Manual
   Play (admin), honest weighted-by-person.
5. **Themes + polish** — 6 themes, fonts, reduced motion, sound/haptics,
   mobile pass.
6. **Cutover** — prod import, announcement, old-URL redirect. Then add
   `docs/ARCHITECTURE.md` / `CLAUDE.md` sections and move the BRETT-TODO item
   to Done.

PRs 2–3 could merge into one if appetite; 4 is the showpiece and should stay
its own PR.

## 6. Out of scope (from FUTURE_IDEAS.md — later, not parity)

Round counter / "never played" badges, tags, ratings, analytics, winner/score
tracking (the log comments are mostly "Brett won by 2" — a `winnerPlayerId`
column would be the cheapest win later), multi-course sessions, SIM_ROUND tee
time type (calendar seam from BRETT-TODO), Google Places photos.

## 7. Open decisions

1. Who are **Lee** and **Mikey** in tee3golf terms (EVENT user, Guest, or
   drop)?
2. Should `EVENT`-role users see `/sim`?
3. Weighted-by-person: apply tallies within a player's share? (recommend yes)
4. Persist Wheel Mode as a shared setting, or keep it per-session (parity)?
5. On Play, remove the course from all lists or just the suggesters'? (match
   PHP once we see it)
6. Target date — first winter sim night?

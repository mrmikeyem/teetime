# Application architecture

Status: written 2026-06-05. App-level companion to `docs/INFRA.md`
(infrastructure) and `/CLAUDE.md` (AI working agreements). This is the
"what exists and how it connects" reference for developers and their AI
assistants.

## Stack

Next.js 16 App Router (TS) · Prisma + Postgres 16 (docker) · next-auth v5
beta (JWT credentials) · nodemailer→Resend SMTP · web-push · Zod +
react-hook-form · Tailwind · `@anthropic-ai/sdk` (weather blurbs).

## Data model (prisma/schema.prisma → snake_case tables)

| Model | Table | Purpose / notable fields |
|---|---|---|
| `User` | `users` | role `BASIC\|ADMIN`; **`email` is nullable**; unique `username`; `lastLoginAt` |
| `Guest` | `guests` | non-account players admins/members can add to rounds |
| `TeeTime` | `tee_times` | one model, two variants via `type` (`TEE_TIME`/`TOURNAMENT`); tournament-only fields (format, entryFee, teamSize, signupDeadline, isShotgun, rangeOpensTime…); `lat`/`lon` geocoded from course name |
| `TeeTimeMember` | `tee_time_members` | exactly one of `userId`/`guestId` (CHECK constraint); `confirmed`; `remindedAt` dedupes the 1h reminder; unique per (teeTime,user) and (teeTime,guest) |
| `PushSubscription` | `push_subscriptions` | web-push endpoints; **origin-scoped** — a domain change invalidates them all |
| `NotificationPreference` | `notification_preferences` | per-user opt-outs incl. `unsubscribedAll` (set by email unsubscribe link) |
| `EmailActionToken` | `email_action_tokens` | single-use hashed tokens for email links (confirm/decline/leave/join/cancel_teetime/unsubscribe) |
| `PasswordResetToken` | `password_reset_tokens` | doubles as the invite-completion token |
| `EmailLog` | `email_log` | audit row per send (kind/status/error/attempts), written by the mailer |
| `Notification` | `notifications` | in-app feed (the header bell); a persistent mirror of every nudge — `type`, `title`, `body`, `url` (`/tee-times/<id>`), `readAt`, `dismissedAt`. Written regardless of prefs (the "in case you missed it" channel); pruned hourly (read >30d, any >90d) |
| `Feedback` | `feedback` | user feedback / feature requests — `type` (bug/idea/other), `message`, `userId`. Submitted at `/feedback`; emails all admins (Reply-To = submitter) + persists the row |

## Route map

### Pages
- `(auth)`: `/login`, `/register` (static invite-only notice), `/forgot-password`, `/reset-password`, `/set-password` (invite completion)
- `(app)` (middleware-gated): `/tee-times` (list + calendar + SSE auto-refresh + notification bell), `/tee-times/new`, `/tee-times/[id]` (roster, join/leave/confirm, weather, "what to expect"), `/tee-times/[id]/edit`, `/notifications` (full activity-feed history), `/feedback` (user feedback form), `/profile` (push toggle, calendar feed, defaults, prefs), `/account`, `/admin` (users + invites), `/admin/emails` (send log), `/admin/feedback` (submitted feedback, type-filterable)
- `/email-actions/[action]` + `/email-actions/result`: no-login landing pages for email links

### API (all return JSON; auth = session unless noted)
- `POST /api/tee-times` create (+creator auto-member, +picked members) · `PATCH|DELETE /api/tee-times/[id]`
- `POST|PATCH|DELETE /api/tee-times/[id]/members` — join/add, confirm-toggle, remove. Each mutation: DB write → `broadcastChange()` → notification fan-out
- `GET /api/events` — SSE stream (see Real-time)
- `POST /api/auth/register` (ADMIN; invite by email) · `complete-invite` · `forgot-password` · `reset-password` (all token-based, no session)
- `POST /api/email-actions/[action]` — consumes `EmailActionToken`s (no session)
- `GET /api/calendar/[token]` — per-user ICS feed (token auth)
- `POST /api/cron/reminders` — `x-cron-secret` header auth; hit by systemd timer every 5 min
- `POST /api/inbound/email` — Resend `email.received` webhook (svix-signature auth). Member resolved by `From:` (manual fwd) or forwarding headers (Gmail auto-fwd). Haiku classifies `email_kind`: confirmation → dedupe → tee time created as the forwarder; cancellation → email the member a choice (never auto-acts); Google forwarding-confirmation → relayed to the requesting member (onboarding)
- `/api/admin/users/[id]` (+`/role`) — admin user management; protected-user guard in `lib/admin.ts`
- `POST /api/admin/broadcast/forwarding-howto` — admin-only one-off enhancement announcement (supports `testTo`/`dryRun`); respects `unsubscribedAll`
- `/api/profile/*` — push subscription, calendar token rotation, defaults, notification prefs
- `POST /api/notifications/read` (mark read, all or by ids) · `/dismiss` (soft-dismiss via `dismissedAt`) · `/action` (session-authed inline Confirm/Decline/Join/Leave — re-validates live `actionState`, 409s stale taps, calls the shared `tee-time-actions` cores). No `GET` — the bell is server-rendered from `getResolvedFeed` and refreshes via SSE
- `POST /api/feedback` — user feedback (type bug/idea/other + message); saves a `Feedback` row + emails all admins with Reply-To = submitter (`kind: "feedback"`); types/validation/cap shared via `lib/feedback-types.ts`
- `/api/guests`, `/api/users/search`, `/api/weather`

## lib/ inventory

| Module | Exports / role |
|---|---|
| `auth.ts` | next-auth config; JWT carries `id`+`role`; session callback copies them onto `session.user` |
| `admin.ts` | `requireAdmin()` (redirects), `isAdmin()`, `isProtectedUserId()` |
| `prisma.ts` | client singleton (globalThis guard for dev HMR) |
| `events.ts` | `broadcastChange(teeTimeId?)`, `subscribeToChanges()` — in-process pub/sub backing SSE |
| `mailer.ts` | `sendMail({to,subject,text,html,kind,replyTo?})` — THE email choke point: serialized queue (600ms gap, 3 retries) + `email_log` writes; optional `replyTo` (feedback sets it to the submitter) |
| `feedback-types.ts` | single source for the feedback set (bug/idea/other) + label + `isFeedbackType` validator + message cap — shared by the form, API route, and email template (client-safe, no server-only) |
| `email-templates.ts` | one function per email kind; shared `shell()`/`btn()` HTML helpers |
| `email-actions.ts` | `mintToken`/`verifyToken`/`markUsed`/`buildActionUrl` for email link actions |
| `tee-time-actions.ts` | `confirmMembership`/`declineOrLeaveMembership`/`joinTeeTime` — shared mutation cores (DB write + `broadcastChange` + `notify*`), called by BOTH the email-action route and the inline feed-action route so they behave identically |
| `notification-events.ts` | `notifyMemberJoined/Left/AddedToTeeTime/NewTeeTime` — fan-out per recipient: **records the in-app feed (always), then** pref-filters → email + push. Feed write is NOT pref-gated |
| `notification-feed.ts` | `recordNotification`/`recordNotificationOnce` (write a feed row; "Once" is idempotent on (user,type,url) for the reminder cron), `getResolvedFeed` (load feed + enrich each item with live `actionState`: confirmable/confirmed/joinable/full/already_on/past/gone/none) |
| `notifications.ts` | `shouldNotify`, `filterEligibleUsers` (preference checks — email/push only; the feed ignores them) |
| `push.ts` | `sendPushToUser` — web-push, prunes 410-gone endpoints |
| `ics.ts` | calendar feed rendering; **UID_DOMAIN frozen at infiniterien.com on purpose** (stable UIDs) |
| `weather.ts` | Open-Meteo geocode (24h cache) + forecast (30m cache) |
| `weather-summary.ts` | `getRoundSummary` — Claude `claude-haiku-4-5` blurb for the detail page |
| `inbound-email.ts` | webhook signature verify (svix scheme, no dep), Resend received-email fetch, `forwardingMailboxes()` (Gmail auto-fwd member from headers), Haiku `email_kind` classification + booking extraction (JSON-schema + zod), `parseForwardingConfirmation()` (Google onboarding link), CT-wall-time→UTC |
| `tournament.ts` | `parseTournamentFields` — validation for the TOURNAMENT variant |
| `time.ts` | America/Chicago helpers (`startOfTodayInAppTz`) — app displays Central, server runs UTC |
| `tee-time-defaults.ts` | per-user new-tee-time defaults |

## Cross-cutting flows

**Join a tee time** (the canonical mutation): client POSTs
`/api/tee-times/[id]/members` → unique-constraint create (409 on dupe;
self-join auto-confirms) → `broadcastChange(teeTimeId)` → every open
client's EventSource fires `router.refresh()` (~1s) →
`notifyAddedToTeeTime` + `notifyMemberJoined` record an in-app feed row for
each recipient (always) then fan out email (queued) + push to eligible
users → each email lands in `email_log`. The SSE refresh re-renders the bell,
so the feed badge updates live (~1s) for joins/leaves/adds/new-tee-times.

**In-app feed (the header bell)**: every nudge is mirrored to a `Notification`
row via `recordNotification`, written regardless of prefs — it's the "in case
you missed it" channel. The bell on `/tee-times` is server-rendered from
`getResolvedFeed` (which attaches a LIVE `actionState` per item, so buttons are
never dead) and rides the existing SSE `router.refresh()`. Items offer inline
Confirm/Decline/Join/Leave (→ `/api/notifications/action` → shared
`tee-time-actions` cores), per-item dismiss, and mark-all-read; "See all" opens
`/notifications`. Reminders are the one non-live source (no `broadcastChange`) —
they surface on the next refresh/resume/30s-poll.

**Invite a user**: admin POSTs email → provisional user (random unusable
password hash) + 7-day token → invite email → `/set-password` →
`complete-invite` finalizes transactionally → all admins get an
"admin-alert" email.

**1h reminder**: timer ticks `/api/cron/reminders` → members of tee times
inside the window with `remindedAt IS NULL` get a feed row
(`recordNotificationOnce`, idempotent) + email + push → `remindedAt` stamped;
editing a tee time's time clears it so reminders re-fire. The cron also runs
the hourly cleanup, which now also prunes old notifications (read >30d, any >90d).

**Email-to-tee-time**: member forwards a ForeUp email to `tee@tee3golf.com`
→ Resend webhook → verify signature → **resolve the member**: by `From:` if
it's a member (manual forward), else by the `Delivered-To`/`X-Forwarded-For`
headers (Gmail filter auto-forward keeps the original `From:`, e.g. ForeUp;
Gmail's `+caf_` envelope passes SPF so it can't be forged). Strangers dropped
silently. Fetch full body from Resend → Haiku classifies `email_kind`:
- **confirmation** → extract course/date/time/players (course canonicalized
  against existing spellings — ForeUp reports the facility, e.g. "King's Walk
  or Lincoln Golf Course") → CT wall time → UTC → dedupe on exact `teeOffAt`
  (duplicate → "already on the board" reply) → create with forwarder as
  confirmed booker → `broadcastChange` + `notifyNewTeeTime` + "created" reply.
- **cancellation** → NEVER auto-acts (ambiguous: removed self vs whole booking
  off). If it matches a tee time the member is on, email them `leave` /
  `cancel_teetime` action links; else drop quietly.
- Failures get a "couldn't read that" reply pointing at /tee-times/new.

**Forwarding onboarding relay**: when a member sets up Gmail auto-forwarding,
Google's confirmation lands at `tee@` (not them). `parseForwardingConfirmation`
detects it (`forwarding-noreply@google.com` + `/mail/vf-` link) and relays the
link to the requesting member's on-file address (parsed address used only to
look them up); unknown requester → admin alert, no relay.

## Client patterns worth knowing

- `AutoRefresh` (SSE) is mounted on list + detail pages; refresh on every
  event AND every (re)connect; 30s poll only as fallback; `pageshow`
  handler for iOS PWA bfcache.
- Mutating buttons are small client components (`join-button`,
  `member-row`, `my-status-bar`, `delete-button`) doing raw `fetch` +
  `router.refresh()`; destructive actions require a `window.confirm`
  (the unguarded ✕ once silently removed a member — don't regress this).
- `MyStatusBar` uses optimistic local state reconciled by refresh.
- `NotificationBell` (+ the `/notifications` page) share `feed-shared.tsx`
  (row rendering + `post*` action helpers). State is a prop-overlay model
  (`overrides`/`dismissed`/`clearedSig` layered over always-fresh server props)
  — NOT setState-in-effect/ref-in-render, which the project's react-hooks lint
  rejects. The panel anchors `left-0 z-30` (it's at the header's left edge).
- PWA: standalone display; `sw.js` handles push + notification clicks
  only — no fetch caching, so deploys are picked up on next load.

## Security posture (details in INFRA.md / HOTFIX-FOLLOWUP.md)

Invite-only registration (post bot-attack) · middleware auth gate ·
admin APIs 404 to non-admins · email action tokens hashed + single-use ·
nginx rate limits on auth endpoints (real client IPs restored behind
Cloudflare) · origin firewalled to CF ranges · robots.txt + noindex.

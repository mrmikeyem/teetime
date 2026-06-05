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
| `EmailActionToken` | `email_action_tokens` | single-use hashed tokens for email links (confirm/decline/leave/join/unsubscribe) |
| `PasswordResetToken` | `password_reset_tokens` | doubles as the invite-completion token |
| `EmailLog` | `email_log` | audit row per send (kind/status/error/attempts), written by the mailer |

## Route map

### Pages
- `(auth)`: `/login`, `/register` (static invite-only notice), `/forgot-password`, `/reset-password`, `/set-password` (invite completion)
- `(app)` (middleware-gated): `/tee-times` (list + calendar + SSE auto-refresh), `/tee-times/new`, `/tee-times/[id]` (roster, join/leave/confirm, weather, "what to expect"), `/tee-times/[id]/edit`, `/profile` (push toggle, calendar feed, defaults, prefs), `/account`, `/admin` (users + invites), `/admin/emails` (send log)
- `/email-actions/[action]` + `/email-actions/result`: no-login landing pages for email links

### API (all return JSON; auth = session unless noted)
- `POST /api/tee-times` create (+creator auto-member, +picked members) · `PATCH|DELETE /api/tee-times/[id]`
- `POST|PATCH|DELETE /api/tee-times/[id]/members` — join/add, confirm-toggle, remove. Each mutation: DB write → `broadcastChange()` → notification fan-out
- `GET /api/events` — SSE stream (see Real-time)
- `POST /api/auth/register` (ADMIN; invite by email) · `complete-invite` · `forgot-password` · `reset-password` (all token-based, no session)
- `POST /api/email-actions/[action]` — consumes `EmailActionToken`s (no session)
- `GET /api/calendar/[token]` — per-user ICS feed (token auth)
- `POST /api/cron/reminders` — `x-cron-secret` header auth; hit by systemd timer every 5 min
- `/api/admin/users/[id]` (+`/role`) — admin user management; protected-user guard in `lib/admin.ts`
- `/api/profile/*` — push subscription, calendar token rotation, defaults, notification prefs
- `/api/guests`, `/api/users/search`, `/api/weather`

## lib/ inventory

| Module | Exports / role |
|---|---|
| `auth.ts` | next-auth config; JWT carries `id`+`role`; session callback copies them onto `session.user` |
| `admin.ts` | `requireAdmin()` (redirects), `isAdmin()`, `isProtectedUserId()` |
| `prisma.ts` | client singleton (globalThis guard for dev HMR) |
| `events.ts` | `broadcastChange(teeTimeId?)`, `subscribeToChanges()` — in-process pub/sub backing SSE |
| `mailer.ts` | `sendMail({to,subject,text,html,kind})` — THE email choke point: serialized queue (600ms gap, 3 retries) + `email_log` writes |
| `email-templates.ts` | one function per email kind; shared `shell()`/`btn()` HTML helpers |
| `email-actions.ts` | `mintToken`/`verifyToken`/`markUsed`/`buildActionUrl` for email link actions |
| `notification-events.ts` | `notifyMemberJoined/Left/AddedToTeeTime/NewTeeTime` — fan-out: recipients → pref filter → email + push |
| `notifications.ts` | `shouldNotify`, `filterEligibleUsers` (preference checks) |
| `push.ts` | `sendPushToUser` — web-push, prunes 410-gone endpoints |
| `ics.ts` | calendar feed rendering; **UID_DOMAIN frozen at infiniterien.com on purpose** (stable UIDs) |
| `weather.ts` | Open-Meteo geocode (24h cache) + forecast (30m cache) |
| `weather-summary.ts` | `getRoundSummary` — Claude `claude-haiku-4-5` blurb for the detail page |
| `tournament.ts` | `parseTournamentFields` — validation for the TOURNAMENT variant |
| `time.ts` | America/Chicago helpers (`startOfTodayInAppTz`) — app displays Central, server runs UTC |
| `tee-time-defaults.ts` | per-user new-tee-time defaults |

## Cross-cutting flows

**Join a tee time** (the canonical mutation): client POSTs
`/api/tee-times/[id]/members` → unique-constraint create (409 on dupe;
self-join auto-confirms) → `broadcastChange(teeTimeId)` → every open
client's EventSource fires `router.refresh()` (~1s) →
`notifyAddedToTeeTime` + `notifyMemberJoined` fan out email (queued) +
push to eligible users → each email lands in `email_log`.

**Invite a user**: admin POSTs email → provisional user (random unusable
password hash) + 7-day token → invite email → `/set-password` →
`complete-invite` finalizes transactionally → all admins get an
"admin-alert" email.

**1h reminder**: timer ticks `/api/cron/reminders` → members of tee times
inside the window with `remindedAt IS NULL` get email+push → `remindedAt`
stamped; editing a tee time's time clears it so reminders re-fire.

## Client patterns worth knowing

- `AutoRefresh` (SSE) is mounted on list + detail pages; refresh on every
  event AND every (re)connect; 30s poll only as fallback; `pageshow`
  handler for iOS PWA bfcache.
- Mutating buttons are small client components (`join-button`,
  `member-row`, `my-status-bar`, `delete-button`) doing raw `fetch` +
  `router.refresh()`; destructive actions require a `window.confirm`
  (the unguarded ✕ once silently removed a member — don't regress this).
- `MyStatusBar` uses optimistic local state reconciled by refresh.
- PWA: standalone display; `sw.js` handles push + notification clicks
  only — no fetch caching, so deploys are picked up on next load.

## Security posture (details in INFRA.md / HOTFIX-FOLLOWUP.md)

Invite-only registration (post bot-attack) · middleware auth gate ·
admin APIs 404 to non-admins · email action tokens hashed + single-use ·
nginx rate limits on auth endpoints (real client IPs restored behind
Cloudflare) · origin firewalled to CF ranges · robots.txt + noindex.

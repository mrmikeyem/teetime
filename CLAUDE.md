# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Tee Time Tracker — a private golf-group app (5 real users, invite-only) at
https://tee3golf.com. Next.js 16 App Router + Prisma/Postgres + next-auth v5.
**This repo's checkout at `/opt/teetimes` on the droplet IS production** —
there is no staging. Read `docs/INFRA.md` before touching deploy, nginx,
DNS, or email infrastructure; `docs/ARCHITECTURE.md` for the app-level map.

## Commands

```sh
npm run dev          # next dev on port 3001
npm run build        # production build — MUST exit 0 before any restart
npm run lint         # eslint
npm run db:migrate   # prisma migrate dev (creates + applies a migration)
./deploy.sh          # prod deploy: pull → ci → migrate deploy → build → restart
```

There is no test framework configured. Verification is manual — see
"Testing tricks" in `docs/INFRA.md` for minting a session cookie to curl
authed routes as a real user.

Prod runs as systemd unit `teetimes.service` bound to `127.0.0.1:3001`
behind nginx behind Cloudflare. **Never deploy with
`npm run build | grep ... && systemctl restart`** — a pipe hides the build's
exit code and a failed build will 502 prod (it happened; see INFRA.md).

## Architecture — the parts that span multiple files

**Auth**: next-auth v5 (JWT strategy), credentials provider. `middleware.ts`
gates `/tee-times`, `/admin`, `/account`, `/profile`. Registration is
ADMIN-only and invite-based: `POST /api/auth/register` (email only) creates a
provisional user + mails a 7-day token; `POST /api/auth/complete-invite`
finalizes name/username/password. `lib/admin.ts` has `requireAdmin()` /
`isAdmin()`. Roles live in the JWT, so role changes apply at next login.
`User.email` is nullable — always null-guard it (a missed guard once broke
the build).

**Every data mutation must do two things** beyond the DB write:
1. `broadcastChange(teeTimeId)` from `lib/events.ts` — feeds the SSE stream
   (`/api/events`) that makes all open clients refresh in ~1s. Forget this
   and other users won't see the change until the 30s fallback poll.
2. If users should be told: go through `lib/notification-events.ts`
   (`notifyMemberJoined`, `notifyMemberLeft`, `notifyAddedToTeeTime`,
   `notifyNewTeeTime`) — these handle email + web push + per-user
   preference filtering (`lib/notifications.ts`) in one place.

**Email**: ALL sends go through `sendMail()` in `lib/mailer.ts` — a
serialized queue (600ms gap, retries) that exists because Resend
rate-limits per-second; bypassing it re-introduces a fixed prod incident.
Inbound too: members forward booking confirmations (ForeUp) to
`tee@tee3golf.com` → Resend `email.received` webhook →
`POST /api/inbound/email` (svix-signature verified, sender must match a
member's email) → Claude Haiku extracts the booking (`lib/inbound-email.ts`,
JSON-schema output) → dedupe on the exact tee-off instant → tee time
created via the normal path (broadcast + notify) → reply email to the
forwarder.
Pass a `kind` — every send is auto-logged to `email_log` and shown at
`/admin/emails`. Templates live in `lib/email-templates.ts` (shared
`shell()`/`btn()` helpers). Emails can contain single-use action links
(confirm/decline/leave/join/unsubscribe) minted by `lib/email-actions.ts`
and consumed by `POST /api/email-actions/[action]` — tokens are hashed at
rest and work without a login session.

**Real-time client**: `(app)/tee-times/auto-refresh.tsx` is an EventSource
client that calls `router.refresh()` on every SSE event AND on every
(re)connect (that's what makes PWA resume show fresh data); 30s polling is
only the fallback while the stream is down. The service worker
(`public/sw.js`) is push-only — it does no page caching, on purpose.

**Tee times**: one `TeeTime` model covers two variants via `type`
(`TEE_TIME` | `TOURNAMENT`); tournament-only fields are parsed/validated by
`lib/tournament.ts`. Members are `TeeTimeMember` rows pointing at either a
`User` or a `Guest` (exactly one, DB-enforced). Reminders: a systemd timer
POSTs `/api/cron/reminders` every 5 min with an `x-cron-secret` header;
`remindedAt` on the member row dedupes, and editing a tee time's time
clears it so reminders re-fire.

**Weather**: `lib/weather.ts` (Open-Meteo geocode + forecast, cached via
`next: { revalidate }`) and `lib/weather-summary.ts`, which calls Claude
(`claude-haiku-4-5` via `@anthropic-ai/sdk`, `ANTHROPIC_API_KEY` in env) to
write the "what to expect" blurb on a tee time's detail page.

**Calendar**: `/api/calendar/[token]` serves a per-user ICS feed.
`lib/ics.ts` `UID_DOMAIN`/`PRODID` intentionally still reference
infiniterien.com (the pre-2026-06 domain) — changing them would duplicate
every event in subscribers' calendars. Leave them.

## Conventions

- Prisma models map to snake_case (`@map`/`@@map`); ids are `uuid()` `@db.Uuid`.
- Server-only libs start with `import "server-only"`.
- App-display timezone is America/Chicago (`lib/time.ts`); the server and
  DB run UTC. Don't render raw UTC to users.
- Migrations on prod are generated with
  `prisma migrate diff --from-url $DATABASE_URL --to-schema-datamodel
  prisma/schema.prisma --script` into `prisma/migrations/<ts>_name/`, then
  `prisma migrate deploy` (no shadow DB on the droplet).
- Git: no global identity on the droplet — commit with
  `git -c user.name="..." -c user.email="..."`.
- One-off prod scripts are `_*.mjs` in the repo root (gitignored pattern:
  they're temporary); delete after use.

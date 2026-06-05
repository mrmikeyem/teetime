# Infrastructure & operations reference

Status: written 2026-06-05 after the overnight hardening/cutover session.
This is the canonical "how production actually runs" doc. If it disagrees
with an older doc, this one wins.

## The 30-second map

```
user → Cloudflare (orange cloud) → ufw (CF ranges only) → nginx → next (127.0.0.1:3001) → postgres (docker, 127.0.0.1:5432)
```

- **Droplet**: "valhalla", 24.199.102.162, Ubuntu, 1GB RAM. Also hosts
  shiver-track (port 3000, shivermequivers.com — separate project).
- **Domain**: https://tee3golf.com (live since 2026-06-05).
  infiniterien.com 301s to it permanently — old email links and calendar
  feeds keep working through the redirect.
- **SSH**: the apex domains resolve to Cloudflare now, NOT the droplet.
  Use `direct.tee3golf.com` or the IP.

## Process supervision — all systemd, no pm2

| Unit | What | Notes |
|---|---|---|
| `teetimes.service` | the app, `next start -p 3001 -H 127.0.0.1` | Restart=always; **localhost-only bind is deliberate** |
| `teetimes-cron.timer` | POSTs `/api/cron/reminders` every 5 min | hits 127.0.0.1 directly with `x-cron-secret` from .env |
| `shiver-track.service` | the other app on :3000 | don't touch from this repo |
| `nginx`, `docker`, `fail2ban` | enabled | postgres container is `restart=unless-stopped` |

Everything above survives reboot with zero manual steps. Logs:
`journalctl -u teetimes -f`.

## Deploying

```sh
cd /opt/teetimes && ./deploy.sh
```

deploy.sh is `set -euo pipefail`: pull → npm ci → prisma migrate deploy →
build → restart. **Do not freelance a deploy as
`npm run build 2>&1 | grep ... && systemctl restart`** — the pipe makes
grep's exit code gate the `&&`, a failed build slips through, and the
restart launches onto a half-written `.next`. That exact mistake 502'd
prod for ~4 minutes on 2026-06-05. Build must exit 0 before restart, and
deploy.sh already guarantees that.

Git on the droplet: no global identity; commit with
`git -c user.name="..." -c user.email="..."`. Deploy key history: was
read-only; write-enabled key pending (delete + re-add on GitHub with
"Allow write access" — permissions can't be edited in place).

## Network / firewall — defense in depth

1. **Cloudflare** proxies both domains (orange cloud). SSL mode is
   Full/strict (verified behaviorally — no redirect loop).
2. **ufw**: default deny; 22/tcp rate-limited (`limit`); 80/443 allowed
   **only from Cloudflare ranges** (pinned 2026-06-05 from
   api.cloudflare.com/client/v4/ips — if CF ever changes ranges, refresh
   the ufw rules AND `/etc/nginx/conf.d/cloudflare-realip.conf` together).
   Direct-to-IP web traffic is dropped — verified from external nodes,
   not from the droplet (own-IP tests hairpin via loopback and lie to you).
3. **nginx real-ip**: `cloudflare-realip.conf` restores true client IPs
   from `CF-Connecting-IP`. Without it the auth rate limits would key on
   CF edge IPs and throttle everyone at once.
4. **fail2ban**: sshd jail, aggressive mode, 4 strikes/10 min → 1h ban
   doubling to 1 week. Note: iptables bans only matter for direct traffic
   (SSH). Web-layer bans behind CF need the `cloudflare-token` action and
   a Zone-Firewall-scoped API token — planned, not yet done.
5. **App**: registration is admin-only (see HOTFIX-FOLLOWUP.md), SSE and
   admin routes auth-gated, `robots.txt` + `noindex` everywhere.

Secrets live in `/root/.secrets/` (mode 600): per-zone Cloudflare API
tokens (DNS-edit only — they canNOT touch zone settings or firewall) and
the pre-cutover Resend DNS records backup. App secrets in
`/opt/teetimes/.env` (gitignored, as are `.env.bak.*`).

## Email stack

- Resend SMTP (smtp.resend.com:2465), from `no-reply@tee3golf.com`.
  Domain verified in Resend 2026-06-05; SPF/DKIM records in the
  tee3golf.com Cloudflare zone.
- DMARC: `p=none`, reports to Mike's gmail. Tighten to `p=quarantine`
  once a week of reports looks clean. (BIMI was evaluated and skipped:
  Gmail requires a ~$1k/yr VMC + registered trademark.)
- **All sends go through `lib/mailer.ts`** — a serialized queue (600ms
  gap, 3 retries) that exists because Resend rate-limits per-second and a
  fan-out once blew past it. Never email users around it.
- Every send is recorded in `email_log` (kind/status/error/attempts) and
  visible at **/admin/emails**. Admins also get an email when an invitee
  finishes account setup.
- `lib/ics.ts` UID_DOMAIN/PRODID intentionally still say infiniterien.com:
  calendar UIDs must stay stable or every subscriber's events duplicate.

## Real-time (SSE)

- `lib/events.ts`: in-process pub/sub (fine because there is exactly one
  Node process). Every mutation route calls `broadcastChange(teeTimeId)`.
- `/api/events`: auth-gated SSE stream; 30s heartbeat (must stay under
  nginx's 60s read timeout and CF's ~100s idle cut);
  `X-Accel-Buffering: no` so nginx doesn't buffer.
- Client (`auto-refresh.tsx`): EventSource → `router.refresh()` on every
  event (250ms debounce) AND on every (re)connect — reconnect-refresh is
  what makes app-resume show fresh data. 30s polling survives only as the
  fallback while the stream is down. `pageshow`/`persisted` handles iOS
  PWA bfcache restores.
- If you add a mutation route, call `broadcastChange()` or clients won't
  see the change until reconnect/fallback.

## Testing tricks

Mint a real session cookie for curl-testing authed routes (script must
run from /opt/teetimes so `next-auth` resolves):

```js
// node _mint.mjs  (with .env sourced)
import { encode } from "next-auth/jwt";
console.log(await encode({
  token: { sub: USER_ID, id: USER_ID, role: "ADMIN", name, email },
  secret: process.env.AUTH_SECRET,
  salt: "__Secure-authjs.session-token",
  maxAge: 600,
}));
// curl -H "Cookie: __Secure-authjs.session-token=<jwt>" https://tee3golf.com/api/events
```

Delete test scripts when done; don't commit them.

## 2026-06-05 session changelog (one night, in order)

1. Diagnosed "Brice disappeared from a tee time": he fat-fingered the
   per-row ✕ (no confirm dialog) during concurrent joins — traced via
   nginx logs + DB. Re-added him via SQL; ✕ now confirms (`5792f7a`).
2. SSE real-time shipped (`d9f5b5c`).
3. Domain cutover executed per MIGRATION-PLAN.md via Resend + Cloudflare
   APIs (`fd200dc`). ~10 min planned email-dark window.
4. Orange-clouded both domains; ufw + real-ip + fail2ban + DMARC;
   tee3golf cert renewal moved to DNS-01; app bound to localhost.
5. Email log + /admin/emails + admin new-user alerts + robots/noindex
   (`950a207`) — including the 4-minute self-inflicted 502 documented
   above.

## Open items

- [ ] Push the 4-commit backlog once the deploy key has write access.
- [ ] DMARC → `p=quarantine` (~1 week of clean reports).
- [ ] Login-endpoint abuse: fail2ban `cloudflare-token` action (needs a
      Zone-Firewall-scoped CF token).
- [ ] Group members re-add PWA + push on the new origin.
- [ ] Occasional: refresh CF IP ranges in ufw + realip conf.

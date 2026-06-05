# Hotfix follow-up: harden auth after bot-registration attack

> **Status update 2026-06-05** (see `docs/INFRA.md` for the full picture):
> - **Item 2 (orange cloud + real-ip): ✅ DONE** — both domains proxied,
>   `cloudflare-realip.conf` live, verified externally. Went further than
>   planned: ufw drops 80/443 from non-Cloudflare sources entirely, and
>   the app binds 127.0.0.1 (direct-to-IP bypass closed).
> - **Item 3 (fail2ban): ✅ partially** — installed, aggressive sshd jail.
>   The nginx-abuse jail still needs the `cloudflare-token` ban action
>   (iptables bans can't touch proxied traffic) + a Zone-Firewall token.
> - **Item 1 (login rate limit): ⏳ open** — fold into the fail2ban CF
>   action above.
> - **Phase 3c bonus (301 old domain): ✅ DONE** as part of the cutover.

Status: drafted 2026-06-04 after the 2026-05-27 → 2026-06-03 attack. The
hotfix (admin-only registration + nginx rate limits on register/forgot)
is already live in prod. This doc covers the next-tier defenses to add
when you have a focused window.

## Context — what just happened

Between 2026-05-27 and 2026-06-03 a bot hit `POST /api/auth/register` 99
times (82 successful) and `POST /api/auth/forgot-password` 91 times,
across 76 unique Tor exit IPs, all using one identical Chrome 142/Mac
user-agent. No follow-on activity from the registered accounts — pattern
matches generic **account farming** (register, age, sell or use later).

What's already live as of the hotfix:
- `POST /api/auth/register` returns 404 unless caller has an ADMIN session.
- `/register` page is a static "invite only" notice.
- `/login` no longer links to `/register`.
- Nginx rate limit on `/api/auth/register` and `/api/auth/forgot-password`:
  5 r/m per IP, burst 3, shared zone `teetimes_auth`, both domains.

Live as of 2026-06-04 (invite-by-email flow, commit `1066edb`):
- `POST /api/auth/register` (still ADMIN-only) now takes **email only**. It
  creates the user with a provisional username + an unusable random password
  hash, mints a 7-day single-use token, and emails a setup link. Admins no
  longer set or know anyone's password.
- New `/set-password` page: the invitee enters first/last name + a password.
- New `POST /api/auth/complete-invite`: finalizes username/name/password and
  consumes the token transactionally (resolves username collisions). Login is
  impossible for an invited user until they complete this step.
- Reuses the existing `PasswordResetToken` model — no schema migration.
- ✅ Verified end-to-end in prod 2026-06-04: a real invite went out, the
  invitee set their name + password, username finalized correctly, the token
  was consumed, and login succeeded. The username-collision and consume-
  transaction paths both exercised against live data; test user removed after.

Known gaps this doc addresses, in priority order.

---

## Item 1 — Rate-limit the login endpoint (~30 min, do first)

**Why:** With `/register` closed, the next vector is brute-forcing
`/login` against the 5 known usernames. NextAuth has no built-in rate
limit; bcrypt cost-12 (~250ms) is the only speed bump today. A
Tor-rotating attacker can still try thousands of common passwords per
user per day undetected.

**Files**
- `/etc/nginx/sites-available/tee3golf`
- `/etc/nginx/sites-available/teetimes`

**Change** — add to both site files, inside the `server { listen 443 ssl; }`
block, alongside the existing `/api/auth/register` and
`/api/auth/forgot-password` locations:

```nginx
location = /api/auth/callback/credentials {
    limit_req zone=teetimes_auth burst=3 nodelay;
    limit_req_status 429;
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

Reuses the existing zone — no new `limit_req_zone` directive needed.

**Apply**
```sh
nginx -t && systemctl reload nginx
```

**Test**
```sh
# Confirm the path is correct first — should see action="/api/auth/callback/credentials":
curl -sS https://tee3golf.com/login | grep -oE 'action="[^"]+"'

# Hammer with wrong creds. Expect first ~3 → 200/302, then 429:
for i in 1 2 3 4 5 6 7 8; do
  curl -sS -o /dev/null -w "$i: %{http_code}\n" -X POST \
    https://tee3golf.com/api/auth/callback/credentials \
    -d 'username=mikeyem&password=wrong&csrfToken=&callbackUrl=/'
done

# Real-user sanity: log in normally from your laptop, should still work fine.
```

**Rollback:** remove the location block, `nginx -t && systemctl reload nginx`.

**Acceptance:** real users log in normally; the 4th rapid bad attempt from
the same IP returns 429.

---

## Item 2 — Cloudflare orange cloud + Full (strict) TLS (1-2 hrs)

**Why:** Today the droplet IP (`24.199.102.162`) is directly reachable.
Flipping to Cloudflare proxy gives you free DDoS protection, bot
management, and a WAF — and the ability to write rules like
"block requests to `/api/auth/*` from Tor" in their dashboard without
touching nginx. Cloudflare's free tier covers everything needed.

### 2a. Pre-flight (before flipping)

1. Audit anything that hits the droplet by IP or by Host header — those
   bypass Cloudflare and could break:
   ```sh
   grep -rn "24.199.102.162\|infiniterien.com\|tee3golf.com" \
     /etc/cron* /etc/systemd /opt/teetimes/.env 2>/dev/null
   ```
2. Confirm `/api/cron/reminders` trigger source. If it's hit externally,
   that traffic will go through CF now (fine, but path must not be WAF-blocked).
3. Confirm Let's Encrypt cert at origin is valid (it is, per migration
   plan — expires 2026-08-22). Required for "Full (strict)" mode.

### 2b. The flip

1. Cloudflare → `tee3golf.com` zone → DNS → click the cloud icon on the
   `A` record → flip to **orange (proxied)**. Leave `infiniterien.com`
   gray for one day as a control.
2. **SSL/TLS → Overview → set "Full (strict)"**.
   ⚠️ Do NOT pick "Flexible" — that runs HTTP between CF and your origin,
   which is a downgrade. You have a valid cert at origin → Full (strict)
   is correct.
3. **Edge Certificates → Always Use HTTPS: On**.
4. **Network → WebSockets: On** (future-proofing).

### 2c. Restore real client IPs in nginx logs

This is essential — without it, every visitor looks like one of ~10
Cloudflare edge IPs, which breaks the rate limiter (all hits collapse
onto the same `$binary_remote_addr`).

Create `/etc/nginx/conf.d/cloudflare-real-ip.conf`:
```nginx
# Cloudflare IP ranges — keep current via https://www.cloudflare.com/ips/
# Last updated: <DATE YOU PASTED THIS>
set_real_ip_from 173.245.48.0/20;
set_real_ip_from 103.21.244.0/22;
set_real_ip_from 103.22.200.0/22;
set_real_ip_from 103.31.4.0/22;
set_real_ip_from 141.101.64.0/18;
set_real_ip_from 108.162.192.0/18;
set_real_ip_from 190.93.240.0/20;
set_real_ip_from 188.114.96.0/20;
set_real_ip_from 197.234.240.0/22;
set_real_ip_from 198.41.128.0/17;
set_real_ip_from 162.158.0.0/15;
set_real_ip_from 104.16.0.0/13;
set_real_ip_from 104.24.0.0/14;
set_real_ip_from 172.64.0.0/13;
set_real_ip_from 131.0.72.0/22;
set_real_ip_from 2400:cb00::/32;
set_real_ip_from 2606:4700::/32;
set_real_ip_from 2803:f800::/32;
set_real_ip_from 2405:b500::/32;
set_real_ip_from 2405:8100::/32;
set_real_ip_from 2a06:98c0::/29;
set_real_ip_from 2c0f:f248::/32;

real_ip_header CF-Connecting-IP;
real_ip_recursive on;
```

Then:
```sh
nginx -t && systemctl reload nginx
```

### 2d. Verify

```sh
# Should respond, with a cf-ray header:
curl -sS -I https://tee3golf.com | grep -iE 'cf-ray|server'

# Origin IP should NOT appear in DNS now:
dig tee3golf.com +short
# Expect: Cloudflare anycast IPs (104.x.x.x or 172.x.x.x), not 24.199.102.162.

# Real-IP test: hit from your phone hotspot, then check nginx log.
# Should show your phone's real IP, NOT 162.158.x.x / 172.68.x.x:
tail -n 5 /var/log/nginx/access.log
```

### 2e. Optional but cheap (do once orange is verified working)

- **WAF custom rule** (Security → WAF → Custom rules):
  - Field: `URI Path`, operator: `starts with`, value: `/api/auth/`
  - AND `Threat Score` greater than `10` — or `AS Num` in list of known
    Tor exits — actions: **Block**.
  - This rule would have killed the original attack at the edge.
- **Bot Fight Mode** (Security → Bots): toggle on. Free, blocks
  generic scripted clients.

### 2f. Rollback

Flip the DNS cloud back to gray. ~30 seconds. Cert and origin unchanged.

### Acceptance
- App reachable at `https://tee3golf.com`, response has `cf-ray` header.
- `dig tee3golf.com +short` shows Cloudflare IPs only.
- Nginx access log shows real client IPs, not CF edges.
- Log in, create a tee time, browse — full real-user smoke.

---

## Item 3 — fail2ban for nginx 4xx spam (2-3 hrs)

**Skip this entirely if you did Item 2.** Cloudflare's bot fight mode +
WAF rules handle this at a better layer. Only do this if you stay on
gray cloud (or as belt-and-suspenders).

**Install + configure**
```sh
apt-get install -y fail2ban
```

Create `/etc/fail2ban/filter.d/teetimes-auth-abuse.conf`:
```ini
[Definition]
failregex = ^<HOST>.*"(POST|GET) /api/auth/(register|forgot-password|callback/credentials).*" (404|429|401)
ignoreregex =
```

Create `/etc/fail2ban/jail.d/teetimes.conf`:
```ini
[DEFAULT]
# Whitelist your home + the droplet itself so you can never ban yourself.
# Add your home IP here before enabling!
ignoreip = 127.0.0.1/8 ::1 24.199.102.162 <YOUR_HOME_IP>

[teetimes-auth-abuse]
enabled = true
filter = teetimes-auth-abuse
logpath = /var/log/nginx/access.log
maxretry = 10
findtime = 60
bantime = 3600
action = iptables-multiport[name=teetimes, port="http,https"]
```

```sh
systemctl enable --now fail2ban
systemctl status fail2ban
```

**Test** (from a non-whitelisted IP, e.g. phone hotspot)
```sh
for i in $(seq 1 12); do
  curl -sS -o /dev/null -X POST https://tee3golf.com/api/auth/register \
    -d '{}' -H 'content-type: application/json';
done
# Then on the droplet:
fail2ban-client status teetimes-auth-abuse
# Should list the test IP as banned. Unban after testing:
fail2ban-client unban <ip>
```

**Rollback:** `systemctl stop fail2ban && systemctl disable fail2ban`.
Leave iptables alone unless you're certain no other rules matter.

**Acceptance:** ban triggers after 10 4xx hits in 60s, auto-clears after
1h, your own IP is never banned.

---

## Deliberately deferred — do NOT start this weekend

- **`audit_log` table for auth events.** Tempting after an incident, but
  build it when you have a specific forensics question you can't answer,
  not speculatively.
- **Email verification on new accounts.** Only needed if you reopen
  public signup. Don't build it.
- **CAPTCHA / Turnstile.** Same reasoning — admin-only registration means
  admins vouch.
- **Any Prisma migrations.** Schema changes are riskier than nginx/CF
  tweaks. Save for a non-weekend session.

---

## Suggested weekend order

| When | What | Time | If you only do one… |
|---|---|---|---|
| Sat morning | Item 1 (login rate limit) | 30 min | ✅ This. Biggest gap. |
| Sat afternoon | Item 2 (Cloudflare orange) | 1-2 hrs | Big posture jump. |
| Sun, optional | Item 3 (fail2ban) | 2-3 hrs | Skip if you did Item 2. |

## Bonus: finish migration plan phase 3c

While you're in nginx configs, finish `docs/MIGRATION-PLAN.md` phase 3c
(replace the `infiniterien.com` proxy with a 301-only redirect block).
The old domain still proxies to the app, which is *how the bot found
you in the first place*. 10 minutes of work, kills the historical
attack surface entirely.

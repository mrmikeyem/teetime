# Domain migration: infiniterien.com → tee3golf.com

> **✅ EXECUTED 2026-06-05 (~02:40–03:05 UTC).** Kept for reference; see
> `docs/INFRA.md` for how prod runs now. Deviations from the plan below:
> - Driven via Resend + Cloudflare APIs instead of dashboards; email-dark
>   window was ~10 minutes, domain verified in ~55s.
> - Phase 3a's `MAIL_FROM` sed didn't match reality — actual `.env` had
>   the unquoted `MAIL_FROM=no-reply@infiniterien.com`; kept `no-reply@`
>   (not the plan's `hello@`) on the new domain.
> - `ics.ts` UID_DOMAIN/PRODID deliberately NOT flipped — changing
>   calendar UIDs would duplicate every subscribed event.
> - Added gray-cloud `direct.tee3golf.com` as the SSH/origin escape hatch
>   (both apex domains were orange-clouded the same night, beyond this
>   plan's scope).
> - Push subscriptions: 3 old-origin rows deleted (plan said 1).
> - Old Resend DNS records backed up to
>   `/root/.secrets/resend-infiniterien-backup.json`.

Status as of 2026-05-24.

## What's already done (Week 1, completed 2026-05-24)

- ✅ Bought `tee3golf.com` via Cloudflare Registrar.
- ✅ Added DNS A records: `tee3golf.com` and `www.tee3golf.com` → `24.199.102.162` (droplet IP), gray cloud (DNS only, matches `infiniterien.com`).
- ✅ Nginx server block created at `/etc/nginx/sites-enabled/tee3golf` proxying to `127.0.0.1:3001` (same Next.js upstream as the old domain).
- ✅ Let's Encrypt cert issued for `tee3golf.com` and `www.tee3golf.com`; auto-renews via certbot's scheduled task. Expires 2026-08-22.
- ✅ Heads-up email sent to all 5 group members on 2026-05-24, from `hello@infiniterien.com`. Tells them both URLs work for ~2 weeks, then cutover.
- ✅ App is reachable at BOTH `https://infiniterien.com` and `https://tee3golf.com` right now.

## The constraint that drives the rest

**Resend free tier only verifies ONE domain at a time.** This means there is no gradual email rollout — at cutover time we must delete `infiniterien.com` from Resend, add `tee3golf.com`, and only flip `MAIL_FROM` once the new domain is verified. **Outbound email is dark during that window** (~5-10 min depending on DNS propagation).

## When to cut over

No fixed date. Pick a low-traffic window — ideally a weekday morning when **no tee times are within the 1-hour reminder window** (the 5-min cron would try to send a reminder during the email outage). Verify by checking the prod DB before starting:

```sh
ssh root@infiniterien.com 'docker exec postgres psql -U teetimes -d teetimes -c "SELECT id, course, tee_off_at FROM tee_times WHERE tee_off_at BETWEEN now() AND now() + interval '\''90 minutes'\'' ORDER BY tee_off_at;"'
```

If empty: safe to proceed.

## Pre-flight (do before cutover day)

- [ ] Add Brett Wysocki as a collaborator on `mrmikeyem/teetime` GitHub repo (Settings → Collaborators). Until done, he can deploy from the droplet but can't push commits from his own machine.

## The cutover playbook

Aim for ~30-45 minutes total. Phases 1-2 are the user's work; phases 3-5 are a developer's work via SSH + git push + deploy.

### Phase 1: pre-cutover checks (5 min)

- [ ] Verify no tee times in next 90 min (see query above).
- [ ] Verify both domains currently serve the app:
  ```sh
  curl -sS -o /dev/null -w "tee3golf → %{http_code}\n" https://tee3golf.com
  curl -sS -o /dev/null -w "infiniterien → %{http_code}\n" https://infiniterien.com
  ```
  Both should return 307 (redirect to /login).
- [ ] Confirm `tee3golf.com` Let's Encrypt cert is still valid:
  ```sh
  ssh root@infiniterien.com 'certbot certificates | grep -A2 tee3golf'
  ```

### Phase 2: domain swap in Resend (5 min, user-side)

- [ ] In Resend dashboard → Domains, **note the existing DNS records** for `infiniterien.com` (in case you want to add it back later).
- [ ] **Delete `infiniterien.com`** from Resend.
- [ ] **Add `tee3golf.com`** to Resend. Use the **root domain** (`tee3golf.com`), not `send.tee3golf.com` — matches the current `hello@infiniterien.com` pattern.
- [ ] Copy the 3 DNS records Resend shows (SPF TXT, DKIM TXT, DMARC TXT).
- [ ] In Cloudflare → `tee3golf.com` zone → DNS → add each record. Disable proxy (gray cloud) on any TXT records that Cloudflare offers to proxy — TXT records must be DNS-only.
- [ ] Wait 1-2 min for DNS propagation, then click **Verify** in Resend.
- [ ] Confirm `tee3golf.com` status flips to "Verified".

**Email is dark from this point until phase 3 deploys.**

### Phase 3: app cutover (10 min, developer-side)

Run all steps in sequence. Each step is small and recoverable.

#### 3a. Update prod `.env`

```sh
ssh root@infiniterien.com
cd /opt/teetimes
cp .env .env.bak.$(date +%Y%m%d-%H%M%S)

# Update three vars:
sed -i 's|AUTH_URL="https://infiniterien.com"|AUTH_URL="https://tee3golf.com"|' .env
sed -i 's|NEXTAUTH_URL="https://infiniterien.com"|NEXTAUTH_URL="https://tee3golf.com"|' .env
sed -i 's|MAIL_FROM="Tee Time Tracker <hello@infiniterien.com>"|MAIL_FROM="Tee Time Tracker <hello@tee3golf.com>"|' .env

# Verify:
grep -E '^(AUTH_URL|NEXTAUTH_URL|MAIL_FROM)=' .env
```

#### 3b. Update code fallback references

Locally:
```sh
cd ~/dev/teetimes
# Find every hardcoded fallback. Likely files: email-templates.ts, email-actions.ts,
# notification-events.ts, weather route, etc. — search:
grep -rn '"https://infiniterien.com"' src/
```

Replace each `?? "https://infiniterien.com"` with `?? "https://tee3golf.com"`. These are fallbacks that only fire if `AUTH_URL` is unset, but worth flipping for hygiene.

Also check:
- `src/app/layout.tsx` — metadata, OG image URLs.
- `public/manifest.webmanifest` — `start_url` and `scope` (should be relative; verify).
- `prisma/schema.prisma` — unlikely to have references but search anyway.

Commit and push:
```sh
git add -A
git commit -m "Switch hardcoded fallback URL to tee3golf.com"
git push origin main
```

#### 3c. Add Nginx 301 redirect for the old domain

Replace `/etc/nginx/sites-enabled/teetimes` with a redirect-only server block. Keep the existing cert references so HTTPS still works:

```sh
ssh root@infiniterien.com
cat > /etc/nginx/sites-available/teetimes <<'EOF'
server {
    server_name infiniterien.com www.infiniterien.com;
    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/infiniterien.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/infiniterien.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    return 301 https://tee3golf.com$request_uri;
}

server {
    listen 80;
    server_name infiniterien.com www.infiniterien.com;
    return 301 https://tee3golf.com$request_uri;
}
EOF
nginx -t && systemctl reload nginx
```

This preserves:
- Old email confirm/decline links (`https://infiniterien.com/email-actions/...`) → 301 to new domain → tokens still work.
- Old calendar feed URLs (`https://infiniterien.com/api/calendar/<token>`) → 301 → calendar clients follow 301 transparently, no user action needed.
- Old bookmarks and any hardcoded links anywhere → 301.

#### 3d. Deploy the code changes

```sh
ssh root@infiniterien.com 'cd /opt/teetimes && ./deploy.sh'
```

The deploy rebuilds Next.js with the new env vars baked in (`AUTH_URL`, `MAIL_FROM`).

### Phase 4: smoke test (5 min)

- [ ] Hit `https://tee3golf.com` in browser, log in, confirm the app loads with the new domain in URL bar.
- [ ] Hit `https://infiniterien.com` — confirm 301 redirect to `tee3golf.com`.
- [ ] Test an email send. Either:
  - Trigger one organically (create a tee time and add a member).
  - Or fire a one-off test via the same nodemailer pattern used in `_send-release.mjs`.
  - Confirm the email arrives with `From: hello@tee3golf.com`.
- [ ] Test push: re-enable on the new origin via /profile. Fire a test push (script lives in chat history from earlier). Confirm delivery.
- [ ] Test an old email's confirm link (find one in your inbox from before cutover). Click it. Should land on `tee3golf.com/email-actions/confirm` via the 301.

### Phase 5: comms + cleanup (10 min)

#### 5a. Send the cutover email

From `hello@tee3golf.com` (new domain, now verified). Subject: "Tee Time Tracker has moved — re-install the app on your phone".

Body should cover:
- Confirmation that the migration is done; the new URL is `tee3golf.com`.
- **iPhone users:** delete the old home screen icon, open `tee3golf.com` in Safari, Share → Add to Home Screen. (Push notifications require the new icon.)
- **Push notifications:** if you had them on, re-enable from Profile on the new domain.
- **Calendar subscriptions:** automatically forwarded, no action needed.
- **Old email links:** still work via redirect.
- **Bookmark:** `https://tee3golf.com`.

Script pattern: see the earlier `_send-migration-headsup.mjs` in chat history. Just edit the subject + body, and `scp` it up.

#### 5b. Update memory notes

Refresh these so future sessions don't get confused:
- `~/.claude/projects/-Users-yemdall-dev-teetimes/memory/project_overview.md` — "Live at" line.
- `~/.claude/projects/-Users-yemdall-dev-teetimes/memory/project_infrastructure.md` — droplet/domain notes.
- `~/.claude/projects/-Users-yemdall-dev-teetimes/memory/project_email.md` — Resend domain.
- `~/.claude/projects/-Users-yemdall-dev-teetimes/memory/MEMORY.md` — index lines that mention the old domain.

Save a new `project_domain_migration.md` summarizing what happened, what's still working via 301, when to consider sunsetting the old domain.

#### 5c. Clean up dead push subscriptions

Origin-scoped subscriptions tied to `infiniterien.com` can't deliver to the new origin (Apple/Google signed the endpoint for the old origin). The `sendPushToUser` helper already prunes endpoints returning 410, but we can clean up proactively:

```sh
ssh root@infiniterien.com 'docker exec postgres psql -U teetimes -d teetimes -c "SELECT COUNT(*) FROM push_subscriptions;"'
# Currently 1 row (Mike's iPhone, registered against infiniterien.com).
# Delete it so we get a clean slate on the new origin:
ssh root@infiniterien.com 'docker exec postgres psql -U teetimes -d teetimes -c "DELETE FROM push_subscriptions;"'
```

Then re-enable from `/profile` on `tee3golf.com`.

### Phase 6: sunset (weeks later)

- Keep the 301 redirect indefinitely (costs nothing).
- The day Nginx access logs show no traffic hitting `infiniterien.com` for weeks, you could drop the DNS A record. Cert renewal will start failing once the domain doesn't resolve to the droplet — that's fine.
- The domain registration at Cloudflare is yours to keep or let lapse. No app dependency.

## Rollback plan (if something goes wrong)

If anything breaks in phase 3 and you need to back out:

1. **Restore prod `.env`** from the backup created in 3a.
2. **Revert Nginx config** by re-enabling the original `teetimes` server block — its content is preserved in git via `deploy.sh`'s `git pull`, but the file on disk would need restoring. Easier: edit it back to a proxy block matching `tee3golf`'s shape.
3. **Restart service:** `systemctl restart teetimes && systemctl reload nginx`.
4. **Re-add `infiniterien.com` to Resend** using the records you noted in phase 2.
5. **Revert the code commit** if it was pushed: `git revert HEAD && git push`.

Recovery point in worst case: phase 2 took down outbound email; phase 3 might have broken login or pages; both are addressed by the steps above.

## Open questions / loose ends

- **Brett's GitHub access** — needs to be added before he can push commits. SSH access to the droplet is already in place.
- **Resend account ownership** — confirm the Resend account is yours (not shared with anyone). Re-verify recovery email is current.
- **Email-from address** — the plan assumes `hello@tee3golf.com`. If you want something else (`notifications@`, `noreply@`, etc.), decide before the cutover so the `MAIL_FROM` update is right the first time.

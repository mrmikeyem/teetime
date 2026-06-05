# Tee Time Tracker

Private golf-group app for scheduling tee times and tournaments —
live at https://tee3golf.com (invite-only, 5 users).

Next.js 16 · Prisma/Postgres · next-auth v5 · SSE real-time · PWA + web push.

```sh
npm install
npm run dev        # http://localhost:3001
```

Production is the checkout at `/opt/teetimes` on the droplet ("valhalla"),
deployed with `./deploy.sh`. There is no staging.

## Docs — read in this order

| Doc | What it covers |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | Working agreements + the invariants you must not break (also read by AI assistants) |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Data model, route map, lib inventory, cross-cutting flows |
| [`docs/INFRA.md`](docs/INFRA.md) | How prod runs: Cloudflare, firewall, systemd, deploy, email stack, ops lessons |
| [`docs/HOTFIX-FOLLOWUP.md`](docs/HOTFIX-FOLLOWUP.md) | 2026-05 bot attack: what happened, hardening done + remaining |
| [`docs/MIGRATION-PLAN.md`](docs/MIGRATION-PLAN.md) | infiniterien.com → tee3golf.com cutover (executed 2026-06-05) |

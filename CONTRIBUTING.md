# Contributing

How Brett works on this repo. Solo dev, AI does most of the coding,
prod is one `./deploy.sh` away — so the rules below exist to keep dumb
mistakes off `tee3golf.com`.

Pairs with:
- `CLAUDE.md` — AI working agreements for the project.
- `docs/ARCHITECTURE.md` — how the app fits together.
- `docs/INFRA.md` — droplet, deploy, nginx, DNS, email.
- `docs/BRETT-TODO.md` — what's next.

## The mental model

- `main` is **always deployable**. Prod follows it (the droplet's
  checkout at `/opt/teetimes` literally pulls `main`).
- All changes happen on a **feature branch** off `main`.
- Branches merge into `main` through a **pull request on GitHub**, never
  by pushing directly to `main`.
- A PR is a chance to read the diff one more time before it becomes
  prod. That's the whole point. Even solo, the diff catches things.
- Deploy happens **after** merge to `main`, by SSH-ing to the droplet
  and running `./deploy.sh`. Never deploy from an unmerged branch.

## A feature, start to finish (the hand-held walkthrough)

### 1. Start clean

```sh
git checkout main
git pull
```

If `git status` shows anything dirty, deal with it before starting.

### 2. Cut a feature branch

```sh
git checkout -b feature/short-name
```

Naming: `feature/google-login`, `feature/scramble-creator`,
`fix/weather-window`, `chore/dep-bump`. Short, kebab-case, the slash is
just convention.

### 3. Code the change

This is where Claude (me) does the bulk of the work. While we're
working:
- I propose edits; you skim before accepting.
- I'll flag anywhere I'm tempted to use `any` / `@ts-ignore` /
  `// @ts-expect-error` — those silence the type system, which is the
  whole reason TypeScript pays for itself. Find the root cause instead.
- I'll point out when a mutation needs `broadcastChange()` + a
  `notify*` (the choke points in `lib/events.ts` and
  `lib/notification-events.ts`). Forgetting either is the easiest way
  to break other users' experience without seeing it locally.
- Email sends go through `sendMail()` in `lib/mailer.ts`. Always. Past
  prod incident.

### 4. Commit as you go

```sh
git add <specific files>          # prefer explicit; avoid `git add -A`
git commit -m "short imperative subject"
```

Small commits are fine — they get squashed at merge anyway. Avoid
amending once pushed; just make a new commit.

### 5. Sanity-check locally before pushing

```sh
npm run build       # MUST exit 0 — this is your type-check + your test suite
npm run lint        # MUST be clean
```

If the build fails: read the error, fix it, build again. Do not deploy
a branch whose build doesn't pass locally — the same failure will 502
prod.

For routes that need a real session, mint a session cookie and curl
the endpoint. Recipe in `docs/INFRA.md` ("Testing tricks").

### 6. Push the branch

```sh
git push -u origin feature/short-name
```

The `-u` (set upstream) is only needed the first time per branch.

### 7. Open a PR

```sh
gh pr create --fill              # uses the last commit msg as title/body
# or
gh pr create                     # prompts you for title + body
```

Then:

```sh
gh pr view --web
```

This opens the PR in your browser. **Read the diff**. Top to bottom.
This is the step that catches things — typos in user-facing copy, an
accidentally-staged debug `console.log`, a stale TODO comment, a
mutation that quietly skipped `broadcastChange`.

If the diff is non-trivial, run `/ultrareview` in Claude Code (it
spins up multi-agent cloud review against the branch). Address what
matters; ignore what doesn't.

### 8. Merge

```sh
gh pr merge --squash --delete-branch
```

Squash so `main`'s history stays one-commit-per-feature. Delete the
remote branch in the same step. Then locally:

```sh
git checkout main
git pull
git branch -d feature/short-name      # cleanup the local branch
```

### 9. Deploy

SSH to the droplet (see `docs/INFRA.md`) and run:

```sh
./deploy.sh
```

That script does: pull → `npm ci` → `prisma migrate deploy` → build →
`systemctl restart teetimes.service`. **Never** rewrite this as a
piped one-liner — a pipe hides `npm run build`'s exit code and a failed
build will 502 prod. (Documented incident.)

After deploy, hit the site, click through the feature you just shipped,
watch for a 502.

## Pre-deploy checklist

Before running `./deploy.sh`, mentally walk this list:

- [ ] PR merged to `main`, branch deleted, local `main` pulled.
- [ ] `npm run build` exits 0 locally.
- [ ] `npm run lint` is clean.
- [ ] If the change adds/removes mutations: every one writes to DB,
      calls `broadcastChange()` (or uses a shared core that does), and
      goes through a `notify*` if a user should be told.
- [ ] If the change touches emails: every send goes through
      `sendMail()` and passes a `kind`.
- [ ] If the change touches `prisma/schema.prisma`: migration is
      generated, committed, and a DB dump was taken (see below).
- [ ] User-facing copy spell-checked.
- [ ] You're not about to walk away from the computer for 8 hours.

## Database changes

Migrations on prod are forward-only and there's no staging copy. Two
rules:

1. **Dump first.** Before any migration, take a snapshot:
   ```sh
   pg_dump $DATABASE_URL > ~/dump-$(date +%Y%m%d-%H%M).sql
   ```
   Stash it on the droplet outside the repo (e.g. `/root/dumps/`).
2. **Generate the migration the documented way** — see CLAUDE.md
   "Conventions" — using `prisma migrate diff` into
   `prisma/migrations/<ts>_name/`, then `prisma migrate deploy`. No
   shadow DB on the droplet.

If a migration goes wrong: restore from the dump (`psql < dump.sql`).
That's the entire rollback story.

## How AI fits in (my role here)

This repo expects pair-coding with Claude as the default. What I do
vs. what you do:

| I do | You do |
|---|---|
| Read the codebase, propose changes, write code. | Approve/reject edits, sanity-check the result. |
| Flag mutation choke points and TS shortcuts. | Decide when a "good enough" simplification is acceptable. |
| Run `npm run build` / `lint` and report failures. | Pull the SSH trigger on `./deploy.sh`. |
| Read the diff on the PR with you. | Be the human eye that the diff matters to. |
| Suggest `/ultrareview` for non-trivial PRs. | Run it (it's user-invoked + billed). |
| Never deploy or push to `main` directly. | Same — even though you can. |

If I'm about to do something destructive (force-push, `reset --hard`,
delete a branch with unmerged work, drop tables), I ask first.

## TypeScript gotchas to watch for

The build catches most of these, but a few patterns sneak past:

- **`User.email` is nullable.** Always null-guard before using it.
  Documented in CLAUDE.md — broke a build once.
- **`any` is a smell, not a fix.** If TS won't let you do something,
  there's usually a reason. Ask before suppressing.
- **`@ts-ignore` / `@ts-expect-error` should be rare and commented**
  with the actual reason. If I find myself wanting one, I'll ask first.
- **Type narrowing inside callbacks** can re-widen — TS forgets what
  you proved a few lines up if a closure intervenes. Hoist the narrowed
  value into a const.
- **Prisma types are generated.** If they look wrong after a schema
  change, re-run `npx prisma generate` (the `db:migrate` script does
  this automatically).
- **`zod`'s inferred type** (`z.infer<typeof schema>`) is the way to
  share validators and types. Don't hand-write both.

## When to loosen these rules

These are guardrails, not handcuffs. Reasonable loosenings:

- **One-line typo fix in copy:** commit directly to `main` is fine.
  Still build locally.
- **Emergency prod fix (site down):** SSH in, fix forward on the
  droplet, backfill the commit afterward. Document what you did.
- **Migration to a brand-new column that's nullable + unused:** the
  dump is probably overkill. Use judgment.

For anything else, keep the workflow. It's slower for the first few
PRs and then it stops feeling slow.

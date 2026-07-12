-- CreateTable
CREATE TABLE "announcements" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "url" TEXT,
    "published_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "announcements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "announcements_published_at_idx" ON "announcements"("published_at");

-- Backfill: features previously announced by one-off broadcast email only
-- (dates = the day each broadcast shipped). The /whats-new page is their
-- permanent in-app home.
INSERT INTO "announcements" ("id", "title", "body", "url", "published_at") VALUES
(
    gen_random_uuid(),
    'Email a booking, get a tee time',
    'Forward a course booking confirmation to tee@tee3golf.com and it lands on the board automatically — course, date, time, you on it. Forward a cancellation and we ask whether to drop just you or cancel the whole thing (never changes anything on its own). Gmail can even auto-forward with two one-time filters — see the how-to below.',
    '/whats-new#email-forwarding',
    '2026-06-05T18:00:00Z'
),
(
    gen_random_uuid(),
    'Send us feedback from the app',
    'There''s a Feedback button in the top bar. Found a bug, got an idea, or just want to tell us something? Pick Bug / Idea / Other and type away — it goes straight to the admins, and we read every one.',
    '/feedback',
    '2026-06-07T18:00:00Z'
),
(
    gen_random_uuid(),
    'Team generator for tournament days',
    'Tap Teams in the top bar: pick who''s playing (guests too — just type their names), then shake out teams three ways — pure random, balanced by handicap, or captains. Re-roll until it looks right, then copy the result into the group chat. Nothing is saved; it''s a quick draw tool.',
    '/teams',
    '2026-07-10T18:00:00Z'
);

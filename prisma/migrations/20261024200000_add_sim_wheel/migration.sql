-- CreateEnum
CREATE TYPE "sim_tally_mode" AS ENUM ('ADDITIVE', 'MULTIPLIER');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "sim_access" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "sim_theme" TEXT;

-- CreateTable
CREATE TABLE "sim_courses" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "api_id" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sim_courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sim_players" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "guest_id" UUID,
    "checked" BOOLEAN NOT NULL DEFAULT false,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sim_players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sim_list_entries" (
    "id" UUID NOT NULL,
    "player_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "tally" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sim_list_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sim_plays" (
    "id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "played_at" TIMESTAMP(3) NOT NULL,
    "date_only" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'wheel',
    "tee_name" TEXT,
    "tee_rating" DECIMAL(4,1),
    "tee_slope" INTEGER,
    "tee_yards" INTEGER,
    "comment" TEXT,
    "logged_by" UUID,
    "legacy_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sim_plays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sim_play_players" (
    "play_id" UUID NOT NULL,
    "player_id" UUID NOT NULL,
    "played" BOOLEAN NOT NULL DEFAULT true,
    "suggested" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "sim_play_players_pkey" PRIMARY KEY ("play_id","player_id")
);

-- CreateTable
CREATE TABLE "sim_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "course_limit" INTEGER NOT NULL DEFAULT 0,
    "tally_enabled" BOOLEAN NOT NULL DEFAULT false,
    "tally_mode" "sim_tally_mode" NOT NULL DEFAULT 'ADDITIVE',
    "tally_multiplier" DECIMAL(3,1) NOT NULL DEFAULT 1.5,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sim_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "golf_course_cache" (
    "api_id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "golf_course_cache_pkey" PRIMARY KEY ("api_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sim_courses_api_id_key" ON "sim_courses"("api_id");

-- CreateIndex
CREATE UNIQUE INDEX "sim_players_user_id_key" ON "sim_players"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "sim_players_guest_id_key" ON "sim_players"("guest_id");

-- CreateIndex
CREATE INDEX "sim_list_entries_player_id_position_idx" ON "sim_list_entries"("player_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "sim_list_entries_player_id_course_id_key" ON "sim_list_entries"("player_id", "course_id");

-- CreateIndex
CREATE UNIQUE INDEX "sim_plays_legacy_id_key" ON "sim_plays"("legacy_id");

-- CreateIndex
CREATE INDEX "sim_plays_played_at_idx" ON "sim_plays"("played_at");

-- AddForeignKey
ALTER TABLE "sim_players" ADD CONSTRAINT "sim_players_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sim_players" ADD CONSTRAINT "sim_players_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "guests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sim_list_entries" ADD CONSTRAINT "sim_list_entries_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "sim_players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sim_list_entries" ADD CONSTRAINT "sim_list_entries_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "sim_courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sim_plays" ADD CONSTRAINT "sim_plays_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "sim_courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sim_plays" ADD CONSTRAINT "sim_plays_logged_by_fkey" FOREIGN KEY ("logged_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sim_play_players" ADD CONSTRAINT "sim_play_players_play_id_fkey" FOREIGN KEY ("play_id") REFERENCES "sim_plays"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sim_play_players" ADD CONSTRAINT "sim_play_players_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "sim_players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- A sim player is exactly one of a member or a guest.
ALTER TABLE "sim_players" ADD CONSTRAINT "sim_players_user_xor_guest"
    CHECK ((user_id IS NULL) <> (guest_id IS NULL));

-- The group's settings row always exists.
INSERT INTO "sim_settings" ("id", "updated_at") VALUES (1, CURRENT_TIMESTAMP);

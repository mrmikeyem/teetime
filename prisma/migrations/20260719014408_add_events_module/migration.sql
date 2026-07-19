-- CreateEnum
CREATE TYPE "event_standings_mode" AS ENUM ('TEAM_CUMULATIVE', 'INDIVIDUAL_POINTS');

-- CreateEnum
CREATE TYPE "event_game_type" AS ENUM ('CLOSEST_TO_PIN', 'LONG_DRIVE', 'CUSTOM');

-- AlterEnum
ALTER TYPE "user_role" ADD VALUE 'EVENT';

-- AlterTable
ALTER TABLE "tee_times" ADD COLUMN     "event_round_id" UUID;

-- CreateTable
CREATE TABLE "events" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "rules" TEXT,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "standings_mode" "event_standings_mode" NOT NULL DEFAULT 'TEAM_CUMULATIVE',
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_teams" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "seq" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_participants" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "team_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_rounds" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "seq" INTEGER NOT NULL,
    "name" TEXT,
    "format" "tournament_format",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_rounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_round_players" (
    "id" UUID NOT NULL,
    "round_id" UUID NOT NULL,
    "participant_id" UUID NOT NULL,
    "team_id" UUID,
    "mulli_front" BOOLEAN NOT NULL DEFAULT false,
    "mulli_back" BOOLEAN NOT NULL DEFAULT false,
    "drive_used" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_round_players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_scores" (
    "id" UUID NOT NULL,
    "round_id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "front_9" INTEGER,
    "back_9" INTEGER,
    "entered_by" UUID NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_games" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "round_id" UUID,
    "type" "event_game_type" NOT NULL DEFAULT 'CUSTOM',
    "name" TEXT NOT NULL,
    "hole" INTEGER,
    "winner_participant_id" UUID,
    "winner_team_id" UUID,
    "payout_note" TEXT,
    "points" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_games_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "events_start_date_idx" ON "events"("start_date");

-- CreateIndex
CREATE UNIQUE INDEX "event_teams_event_id_name_key" ON "event_teams"("event_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "event_participants_event_id_user_id_key" ON "event_participants"("event_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_rounds_event_id_seq_key" ON "event_rounds"("event_id", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "event_round_players_round_id_participant_id_key" ON "event_round_players"("round_id", "participant_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_scores_round_id_team_id_key" ON "event_scores"("round_id", "team_id");

-- CreateIndex
CREATE INDEX "tee_times_event_round_id_idx" ON "tee_times"("event_round_id");

-- AddForeignKey
ALTER TABLE "tee_times" ADD CONSTRAINT "tee_times_event_round_id_fkey" FOREIGN KEY ("event_round_id") REFERENCES "event_rounds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_teams" ADD CONSTRAINT "event_teams_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_participants" ADD CONSTRAINT "event_participants_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_participants" ADD CONSTRAINT "event_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_participants" ADD CONSTRAINT "event_participants_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "event_teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_rounds" ADD CONSTRAINT "event_rounds_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_round_players" ADD CONSTRAINT "event_round_players_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "event_rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_round_players" ADD CONSTRAINT "event_round_players_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "event_participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_round_players" ADD CONSTRAINT "event_round_players_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "event_teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_scores" ADD CONSTRAINT "event_scores_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "event_rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_scores" ADD CONSTRAINT "event_scores_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "event_teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_scores" ADD CONSTRAINT "event_scores_entered_by_fkey" FOREIGN KEY ("entered_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_games" ADD CONSTRAINT "event_games_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_games" ADD CONSTRAINT "event_games_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "event_rounds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_games" ADD CONSTRAINT "event_games_winner_participant_id_fkey" FOREIGN KEY ("winner_participant_id") REFERENCES "event_participants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_games" ADD CONSTRAINT "event_games_winner_team_id_fkey" FOREIGN KEY ("winner_team_id") REFERENCES "event_teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

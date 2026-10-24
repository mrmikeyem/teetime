-- AlterEnum
ALTER TYPE "tee_time_type" ADD VALUE 'SIM';

-- CreateEnum
CREATE TYPE "sim_night_status" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED');

-- AlterTable
ALTER TABLE "tee_times" ADD COLUMN     "sim_status" "sim_night_status",
ADD COLUMN     "sim_venue_id" UUID;

-- CreateTable
CREATE TABLE "sim_venues" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "host_user_id" UUID,
    "standing_day" INTEGER,
    "standing_time" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sim_venues_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sim_venues_name_key" ON "sim_venues"("name");

-- CreateIndex
CREATE INDEX "tee_times_sim_venue_id_tee_off_at_idx" ON "tee_times"("sim_venue_id", "tee_off_at");

-- AddForeignKey
ALTER TABLE "tee_times" ADD CONSTRAINT "tee_times_sim_venue_id_fkey" FOREIGN KEY ("sim_venue_id") REFERENCES "sim_venues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sim_venues" ADD CONSTRAINT "sim_venues_host_user_id_fkey" FOREIGN KEY ("host_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed the two venues. The garage's host is assigned at /admin/sim-venues
-- (no host = books like a normal course, and no standing night is proposed).
INSERT INTO "sim_venues" ("id", "name", "standing_day", "standing_time", "sort_order", "updated_at") VALUES
(gen_random_uuid(), 'Brice''s Garage', 4, '17:30', 0, CURRENT_TIMESTAMP),
(gen_random_uuid(), 'Albatros', NULL, NULL, 1, CURRENT_TIMESTAMP);

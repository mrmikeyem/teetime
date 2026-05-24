-- CreateEnum
CREATE TYPE "tournament_format" AS ENUM ('STROKE', 'SCRAMBLE', 'BEST_BALL', 'MATCH_PLAY', 'OTHER');

-- AlterTable
ALTER TABLE "tee_times" ADD COLUMN     "entry_fee" DECIMAL(10,2),
ADD COLUMN     "format" "tournament_format",
ADD COLUMN     "is_shotgun" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "range_opens_time" TEXT;

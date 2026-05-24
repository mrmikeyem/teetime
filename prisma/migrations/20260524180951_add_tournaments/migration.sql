-- CreateEnum
CREATE TYPE "tee_time_type" AS ENUM ('TEE_TIME', 'TOURNAMENT');

-- AlterTable
ALTER TABLE "tee_times" ADD COLUMN     "external_url" TEXT,
ADD COLUMN     "signup_deadline" TIMESTAMP(3),
ADD COLUMN     "type" "tee_time_type" NOT NULL DEFAULT 'TEE_TIME',
ALTER COLUMN "party_size" DROP NOT NULL,
ALTER COLUMN "party_size" DROP DEFAULT;

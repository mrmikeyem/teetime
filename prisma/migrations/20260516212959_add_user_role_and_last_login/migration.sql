-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('BASIC', 'ADMIN');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "last_login_at" TIMESTAMP(3),
ADD COLUMN     "role" "user_role" NOT NULL DEFAULT 'BASIC';

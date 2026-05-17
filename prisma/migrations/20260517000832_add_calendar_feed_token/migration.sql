-- AlterTable
ALTER TABLE "users" ADD COLUMN "calendar_feed_token" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_calendar_feed_token_key" ON "users"("calendar_feed_token");

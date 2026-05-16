-- AlterTable
ALTER TABLE "tee_time_members" ADD COLUMN     "reminded_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "user_id" UUID NOT NULL,
    "reminders" BOOLEAN NOT NULL DEFAULT true,
    "added_to" BOOLEAN NOT NULL DEFAULT true,
    "joined_by_other" BOOLEAN NOT NULL DEFAULT true,
    "left_by_other" BOOLEAN NOT NULL DEFAULT true,
    "unsubscribed_all" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "email_action_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "tee_time_id" UUID,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_action_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_action_tokens_token_hash_key" ON "email_action_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "email_action_tokens_user_id_idx" ON "email_action_tokens"("user_id");

-- CreateIndex
CREATE INDEX "email_action_tokens_tee_time_id_idx" ON "email_action_tokens"("tee_time_id");

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_action_tokens" ADD CONSTRAINT "email_action_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

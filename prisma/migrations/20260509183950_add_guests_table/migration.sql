-- Drop the unique INDEX on (tee_time_id, user_id) before making user_id nullable
DROP INDEX IF EXISTS "tee_time_members_tee_time_id_user_id_key";

-- Make user_id nullable
ALTER TABLE "tee_time_members" ALTER COLUMN "user_id" DROP NOT NULL;

-- Add guest_id column
ALTER TABLE "tee_time_members" ADD COLUMN "guest_id" UUID;

-- Drop is_stub
ALTER TABLE "users" DROP COLUMN "is_stub";

-- Make password_hash NOT NULL again
ALTER TABLE "users" ALTER COLUMN "password_hash" SET NOT NULL;

-- Create guests table
CREATE TABLE "guests" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "added_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guests_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "tee_time_members" ADD CONSTRAINT "tee_time_members_guest_id_fkey"
    FOREIGN KEY ("guest_id") REFERENCES "guests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "guests" ADD CONSTRAINT "guests_added_by_fkey"
    FOREIGN KEY ("added_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

CREATE UNIQUE INDEX "tee_time_members_tee_time_id_user_id_key" ON "tee_time_members"("tee_time_id", "user_id");
CREATE UNIQUE INDEX "tee_time_members_tee_time_id_guest_id_key" ON "tee_time_members"("tee_time_id", "guest_id");

ALTER TABLE "tee_time_members" ADD CONSTRAINT "tee_time_members_one_of_user_or_guest"
    CHECK ((user_id IS NULL) <> (guest_id IS NULL));

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tee_times" (
    "id" UUID NOT NULL,
    "course" TEXT NOT NULL,
    "tee_off_at" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tee_times_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tee_time_members" (
    "id" UUID NOT NULL,
    "tee_time_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "added_by" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tee_time_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "tee_times_tee_off_at_idx" ON "tee_times"("tee_off_at");

-- CreateIndex
CREATE UNIQUE INDEX "tee_time_members_tee_time_id_user_id_key" ON "tee_time_members"("tee_time_id", "user_id");

-- AddForeignKey
ALTER TABLE "tee_times" ADD CONSTRAINT "tee_times_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tee_time_members" ADD CONSTRAINT "tee_time_members_tee_time_id_fkey" FOREIGN KEY ("tee_time_id") REFERENCES "tee_times"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tee_time_members" ADD CONSTRAINT "tee_time_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tee_time_members" ADD CONSTRAINT "tee_time_members_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

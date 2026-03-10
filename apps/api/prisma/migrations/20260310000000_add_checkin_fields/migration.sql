-- AlterTable
ALTER TABLE "bookings" ADD COLUMN "checkin_token" VARCHAR(64),
ADD COLUMN "checkin_status" VARCHAR(20),
ADD COLUMN "checkin_sent_at" TIMESTAMP(3),
ADD COLUMN "checkin_done_at" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "bookings_checkin_token_key" ON "bookings"("checkin_token");

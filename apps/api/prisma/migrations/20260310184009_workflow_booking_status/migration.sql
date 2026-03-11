-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "statusChangedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "BookingStatusHistory" (
    "id" UUID NOT NULL,
    "bookingId" UUID NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "changedBy" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BookingStatusHistory_bookingId_idx" ON "BookingStatusHistory"("bookingId");

-- AddForeignKey
ALTER TABLE "BookingStatusHistory" ADD CONSTRAINT "BookingStatusHistory_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate existing status values to new workflow statuses
UPDATE "bookings" SET status = 'created' WHERE status = 'pending';
UPDATE "bookings" SET status = 'created' WHERE status = 'confirmed' AND (checkin_status IS NULL OR checkin_status != 'completed');
UPDATE "bookings" SET status = 'registered' WHERE status = 'confirmed' AND checkin_status = 'completed';
UPDATE "bookings" SET status = 'processed' WHERE status = 'completed';

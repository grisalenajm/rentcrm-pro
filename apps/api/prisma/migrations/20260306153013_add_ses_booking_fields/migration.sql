-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "ses_lote" VARCHAR(50),
ADD COLUMN     "ses_sent_at" TIMESTAMP(3),
ADD COLUMN     "ses_status" VARCHAR(20);

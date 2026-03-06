-- CreateTable
CREATE TABLE "booking_guests_ses" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "doc_type" VARCHAR(20) NOT NULL,
    "doc_number" VARCHAR(30) NOT NULL,
    "doc_country" VARCHAR(5) NOT NULL,
    "birth_date" DATE,
    "phone" VARCHAR(30),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_guests_ses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "booking_guests_ses_booking_id_idx" ON "booking_guests_ses"("booking_id");

-- AddForeignKey
ALTER TABLE "booking_guests_ses" ADD CONSTRAINT "booking_guests_ses_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

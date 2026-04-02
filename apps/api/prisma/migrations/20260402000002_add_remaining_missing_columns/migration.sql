-- Migration: add_remaining_missing_columns
-- Second pass after prisma migrate diff confirmed these fields were
-- still absent from the migration history.

-- ──────────────────────────────────────────────
-- users — 2FA / TOTP fields
-- ──────────────────────────────────────────────
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "otp_enabled"     BOOLEAN      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "otp_secret"      VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "otp_verified_at" TIMESTAMP(3);

-- ──────────────────────────────────────────────
-- clients — address fields
-- ──────────────────────────────────────────────
ALTER TABLE "clients"
  ADD COLUMN IF NOT EXISTS "street"      VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "city"        VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "province"    VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "postal_code" VARCHAR(10),
  ADD COLUMN IF NOT EXISTS "country"     VARCHAR(5);

-- ──────────────────────────────────────────────
-- booking_guests_ses — address fields
-- ──────────────────────────────────────────────
ALTER TABLE "booking_guests_ses"
  ADD COLUMN IF NOT EXISTS "street"      VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "city"        VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "province"    VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "postal_code" VARCHAR(10),
  ADD COLUMN IF NOT EXISTS "country"     VARCHAR(5);

-- ──────────────────────────────────────────────
-- contracts — Paperless document link
-- ──────────────────────────────────────────────
ALTER TABLE "contracts"
  ADD COLUMN IF NOT EXISTS "paperless_document_id" INTEGER;

-- ──────────────────────────────────────────────
-- bookings — status default value
-- ──────────────────────────────────────────────
ALTER TABLE "bookings" ALTER COLUMN "status" SET DEFAULT 'created';

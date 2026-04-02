-- Migration: add_missing_columns_and_tables
-- Adds schema fields that were never captured in migration files.
-- All statements use IF NOT EXISTS / DO blocks so this is safe
-- to run against a database that already has some or all of these
-- (e.g. production DBs seeded with prisma db push).

-- ──────────────────────────────────────────────
-- organizations — missing columns
-- ──────────────────────────────────────────────
ALTER TABLE "organizations"
  ADD COLUMN IF NOT EXISTS "public_url"           VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "public_base_url"      VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "paperless_url"        VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "paperless_token"      VARCHAR(500),
  ADD COLUMN IF NOT EXISTS "paperless_secret"     VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "paperless_doc_type_id" INTEGER,
  ADD COLUMN IF NOT EXISTS "bank_swift"           VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "bank_iban"            VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "bank_beneficiary"     VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "ses_entorno"          VARCHAR(20);

-- ──────────────────────────────────────────────
-- properties — missing columns
-- ──────────────────────────────────────────────
ALTER TABLE "properties"
  ADD COLUMN IF NOT EXISTS "country"                    VARCHAR(5),
  ADD COLUMN IF NOT EXISTS "ses_codigo_establecimiento" VARCHAR(20),
  ADD COLUMN IF NOT EXISTS "nrua"                       VARCHAR(80),
  ADD COLUMN IF NOT EXISTS "purchase_price"             DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "paperless_correspondent_id" INTEGER,
  ADD COLUMN IF NOT EXISTS "cadastral_ref"              VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "notes"                      TEXT;

-- ──────────────────────────────────────────────
-- bookings — missing columns + nullable fixes
-- ──────────────────────────────────────────────
ALTER TABLE "bookings"
  ADD COLUMN IF NOT EXISTS "ses_error"       TEXT,
  ADD COLUMN IF NOT EXISTS "welcome_sent_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "notes"           TEXT;

-- client_id and total_amount must be nullable (iCal imports have no client)
ALTER TABLE "bookings" ALTER COLUMN "client_id"    DROP NOT NULL;
ALTER TABLE "bookings" ALTER COLUMN "total_amount" DROP NOT NULL;

-- ──────────────────────────────────────────────
-- expenses — missing columns
-- ──────────────────────────────────────────────
ALTER TABLE "expenses"
  ADD COLUMN IF NOT EXISTS "deductible"            BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "paperless_document_id" INTEGER,
  ADD COLUMN IF NOT EXISTS "paperless_amount"      DOUBLE PRECISION;

-- ──────────────────────────────────────────────
-- booking_payments (new table)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "booking_payments" (
  "id"         UUID           NOT NULL,
  "booking_id" UUID           NOT NULL,
  "concept"    VARCHAR(30)    NOT NULL,
  "amount"     DOUBLE PRECISION NOT NULL,
  "date"       DATE           NOT NULL,
  "notes"      TEXT,
  "created_at" TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "booking_payments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "booking_payments_booking_id_idx" ON "booking_payments"("booking_id");
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'booking_payments_booking_id_fkey'
  ) THEN
    ALTER TABLE "booking_payments"
      ADD CONSTRAINT "booking_payments_booking_id_fkey"
      FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ──────────────────────────────────────────────
-- property_contents (new table)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "property_contents" (
  "id"              UUID         NOT NULL,
  "organization_id" UUID         NOT NULL,
  "property_id"     UUID,
  "template"        TEXT,
  "translations"    JSONB        NOT NULL DEFAULT '{}',
  "updated_at"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "property_contents_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "property_contents_organization_id_property_id_key"
  ON "property_contents"("organization_id", "property_id");
CREATE INDEX IF NOT EXISTS "property_contents_organization_id_idx"
  ON "property_contents"("organization_id");
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'property_contents_organization_id_fkey'
  ) THEN
    ALTER TABLE "property_contents"
      ADD CONSTRAINT "property_contents_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'property_contents_property_id_fkey'
  ) THEN
    ALTER TABLE "property_contents"
      ADD CONSTRAINT "property_contents_property_id_fkey"
      FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ──────────────────────────────────────────────
-- property_rules (new table)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "property_rules" (
  "id"                  UUID         NOT NULL,
  "property_id"         UUID         NOT NULL,
  "organization_id"     UUID         NOT NULL,
  "base_language"       VARCHAR(10)  NOT NULL DEFAULT 'es',
  "base_content"        TEXT         NOT NULL,
  "translations"        JSONB        NOT NULL DEFAULT '{}',
  "translations_edited" JSONB        NOT NULL DEFAULT '[]',
  "updated_at"          TIMESTAMP(3) NOT NULL,
  CONSTRAINT "property_rules_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "property_rules_property_id_key"
  ON "property_rules"("property_id");
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'property_rules_property_id_fkey'
  ) THEN
    ALTER TABLE "property_rules"
      ADD CONSTRAINT "property_rules_property_id_fkey"
      FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ──────────────────────────────────────────────
-- property_documents (new table)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "property_documents" (
  "id"              UUID         NOT NULL,
  "organization_id" UUID         NOT NULL,
  "property_id"     UUID,
  "name"            VARCHAR(255) NOT NULL,
  "file_data"       TEXT         NOT NULL,
  "file_size"       INTEGER      NOT NULL,
  "order"           INTEGER      NOT NULL DEFAULT 0,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "property_documents_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "property_documents_organization_id_idx"
  ON "property_documents"("organization_id");
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'property_documents_organization_id_fkey'
  ) THEN
    ALTER TABLE "property_documents"
      ADD CONSTRAINT "property_documents_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'property_documents_property_id_fkey'
  ) THEN
    ALTER TABLE "property_documents"
      ADD CONSTRAINT "property_documents_property_id_fkey"
      FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- ──────────────────────────────────────────────
-- recurring_expenses (new table)
-- ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "recurring_expenses" (
  "id"              UUID         NOT NULL,
  "property_id"     UUID         NOT NULL,
  "organization_id" UUID         NOT NULL,
  "type"            VARCHAR(20)  NOT NULL,
  "amount"          DOUBLE PRECISION NOT NULL,
  "deductible"      BOOLEAN      NOT NULL DEFAULT false,
  "frequency"       VARCHAR(20)  NOT NULL,
  "day_of_month"    INTEGER      NOT NULL,
  "notes"           TEXT,
  "active"          BOOLEAN      NOT NULL DEFAULT true,
  "next_run_date"   DATE         NOT NULL,
  "last_run_date"   DATE,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "recurring_expenses_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "recurring_expenses_organization_id_active_next_run_date_idx"
  ON "recurring_expenses"("organization_id", "active", "next_run_date");
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'recurring_expenses_property_id_fkey'
  ) THEN
    ALTER TABLE "recurring_expenses"
      ADD CONSTRAINT "recurring_expenses_property_id_fkey"
      FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'recurring_expenses_organization_id_fkey'
  ) THEN
    ALTER TABLE "recurring_expenses"
      ADD CONSTRAINT "recurring_expenses_organization_id_fkey"
      FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- DropIndex
DROP INDEX "organizations_nif_key";

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "currency" VARCHAR(10) DEFAULT 'EUR',
ADD COLUMN     "date_format" VARCHAR(20) DEFAULT 'dd/MM/yyyy',
ADD COLUMN     "email" VARCHAR(255),
ADD COLUMN     "logo" TEXT,
ADD COLUMN     "phone" VARCHAR(30),
ADD COLUMN     "smtp_from" VARCHAR(255),
ADD COLUMN     "smtp_host" VARCHAR(255),
ADD COLUMN     "smtp_pass" VARCHAR(255),
ADD COLUMN     "smtp_port" INTEGER,
ADD COLUMN     "smtp_user" VARCHAR(255),
ALTER COLUMN "nif" DROP NOT NULL;

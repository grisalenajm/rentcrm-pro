-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "ses_codigo_arrendador" VARCHAR(20),
ADD COLUMN     "ses_codigo_establecimiento" VARCHAR(20),
ADD COLUMN     "ses_endpoint" VARCHAR(255),
ADD COLUMN     "ses_password_ws" VARCHAR(100),
ADD COLUMN     "ses_usuario_ws" VARCHAR(100);

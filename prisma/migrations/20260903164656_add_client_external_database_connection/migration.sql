-- AlterTable
ALTER TABLE "clients" ADD COLUMN "externalDbConnectionUri" TEXT;
ALTER TABLE "clients" ADD COLUMN "externalDbDatabaseName" TEXT;
ALTER TABLE "clients" ADD COLUMN "externalDbEngine" TEXT;
ALTER TABLE "clients" ADD COLUMN "externalDbPasswordEnc" TEXT;
ALTER TABLE "clients" ADD COLUMN "externalDbUsername" TEXT;

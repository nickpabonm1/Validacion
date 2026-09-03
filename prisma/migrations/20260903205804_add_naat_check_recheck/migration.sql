-- AlterTable
ALTER TABLE "validation_executions" ADD COLUMN "naatCheckRecheckResult" TEXT;

-- CreateTable
CREATE TABLE "naat_check_configs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "environmentId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "baseUrl" TEXT NOT NULL DEFAULT 'https://uat.firmaautografa.com',
    "usernameEnc" TEXT,
    "passwordEnc" TEXT,
    "acceptedRiskLevel" TEXT NOT NULL DEFAULT 'LOW',
    "webhookUsernameEnc" TEXT,
    "webhookPasswordEnc" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "naat_check_configs_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "api_environments" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "naat_check_configs_environmentId_key" ON "naat_check_configs"("environmentId");

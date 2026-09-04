/*
  Warnings:

  - You are about to drop the column `naatCheckRecheckResult` on the `validation_executions` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_validation_executions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "validationId" TEXT,
    "processName" TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,
    "templateId" TEXT,
    "requestPayload" TEXT NOT NULL,
    "responsePayload" TEXT,
    "normalizedResponse" TEXT,
    "rawStatus" TEXT,
    "normalizedStatus" TEXT NOT NULL DEFAULT 'CREATED',
    "result" TEXT,
    "clientNameMasked" TEXT NOT NULL,
    "clientEmailMasked" TEXT NOT NULL,
    "keyEncrypted" TEXT,
    "vectorEncrypted" TEXT,
    "webSdkState" TEXT,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "lastSyncedAt" DATETIME,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "validation_executions_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "api_environments" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "validation_executions_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "validation_templates" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "validation_executions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_validation_executions" ("clientEmailMasked", "clientNameMasked", "completedAt", "createdAt", "createdById", "environmentId", "id", "isDemo", "keyEncrypted", "lastSyncedAt", "normalizedResponse", "normalizedStatus", "processName", "rawStatus", "requestPayload", "responsePayload", "result", "startedAt", "templateId", "updatedAt", "validationId", "vectorEncrypted", "webSdkState") SELECT "clientEmailMasked", "clientNameMasked", "completedAt", "createdAt", "createdById", "environmentId", "id", "isDemo", "keyEncrypted", "lastSyncedAt", "normalizedResponse", "normalizedStatus", "processName", "rawStatus", "requestPayload", "responsePayload", "result", "startedAt", "templateId", "updatedAt", "validationId", "vectorEncrypted", "webSdkState" FROM "validation_executions";
DROP TABLE "validation_executions";
ALTER TABLE "new_validation_executions" RENAME TO "validation_executions";
CREATE INDEX "validation_executions_validationId_idx" ON "validation_executions"("validationId");
CREATE INDEX "validation_executions_normalizedStatus_idx" ON "validation_executions"("normalizedStatus");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

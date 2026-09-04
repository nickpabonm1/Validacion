-- CreateTable
CREATE TABLE "web_sdk_templates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "environmentId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "onboardingMessages" TEXT,
    "customization" TEXT,
    "checkMaxAttempts" INTEGER,
    "checkAcceptedRisk" TEXT,
    "faceMatchMinConfidence" REAL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "web_sdk_templates_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "api_environments" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "web_sdk_templates_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "web_sdk_templates_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_validation_executions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "validationId" TEXT,
    "processName" TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,
    "templateId" TEXT,
    "webSdkTemplateId" TEXT,
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
    CONSTRAINT "validation_executions_webSdkTemplateId_fkey" FOREIGN KEY ("webSdkTemplateId") REFERENCES "web_sdk_templates" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "validation_executions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_validation_executions" ("clientEmailMasked", "clientNameMasked", "completedAt", "createdAt", "createdById", "environmentId", "id", "isDemo", "keyEncrypted", "lastSyncedAt", "normalizedResponse", "normalizedStatus", "processName", "rawStatus", "requestPayload", "responsePayload", "result", "startedAt", "templateId", "updatedAt", "validationId", "vectorEncrypted", "webSdkState") SELECT "clientEmailMasked", "clientNameMasked", "completedAt", "createdAt", "createdById", "environmentId", "id", "isDemo", "keyEncrypted", "lastSyncedAt", "normalizedResponse", "normalizedStatus", "processName", "rawStatus", "requestPayload", "responsePayload", "result", "startedAt", "templateId", "updatedAt", "validationId", "vectorEncrypted", "webSdkState" FROM "validation_executions";
DROP TABLE "validation_executions";
ALTER TABLE "new_validation_executions" RENAME TO "validation_executions";
CREATE INDEX "validation_executions_validationId_idx" ON "validation_executions"("validationId");
CREATE INDEX "validation_executions_normalizedStatus_idx" ON "validation_executions"("normalizedStatus");
CREATE TABLE "new_web_sdk_share_links" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,
    "templateId" TEXT,
    "webSdkTemplateId" TEXT,
    "processName" TEXT,
    "client" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "executionId" TEXT,
    "createdById" TEXT,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "web_sdk_share_links_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "api_environments" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "web_sdk_share_links_webSdkTemplateId_fkey" FOREIGN KEY ("webSdkTemplateId") REFERENCES "web_sdk_templates" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "web_sdk_share_links_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "validation_executions" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "web_sdk_share_links_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_web_sdk_share_links" ("client", "createdAt", "createdById", "environmentId", "executionId", "expiresAt", "id", "processName", "status", "templateId", "token", "usedAt") SELECT "client", "createdAt", "createdById", "environmentId", "executionId", "expiresAt", "id", "processName", "status", "templateId", "token", "usedAt" FROM "web_sdk_share_links";
DROP TABLE "web_sdk_share_links";
ALTER TABLE "new_web_sdk_share_links" RENAME TO "web_sdk_share_links";
CREATE UNIQUE INDEX "web_sdk_share_links_token_key" ON "web_sdk_share_links"("token");
CREATE UNIQUE INDEX "web_sdk_share_links_executionId_key" ON "web_sdk_share_links"("executionId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;


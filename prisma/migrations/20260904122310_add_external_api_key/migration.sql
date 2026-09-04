-- AlterTable
ALTER TABLE "api_environments" ADD COLUMN "externalApiKeyCreatedAt" DATETIME;
ALTER TABLE "api_environments" ADD COLUMN "externalApiKeyHash" TEXT;
ALTER TABLE "api_environments" ADD COLUMN "externalApiKeyLastUsedAt" DATETIME;
ALTER TABLE "api_environments" ADD COLUMN "externalApiKeyPrefix" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_web_sdk_share_links" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,
    "templateId" TEXT,
    "processName" TEXT,
    "client" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "executionId" TEXT,
    "createdById" TEXT,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "web_sdk_share_links_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "api_environments" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
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

-- CreateIndex
CREATE UNIQUE INDEX "api_environments_externalApiKeyHash_key" ON "api_environments"("externalApiKeyHash");


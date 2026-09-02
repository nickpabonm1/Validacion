-- CreateTable
CREATE TABLE "web_sdk_share_links" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,
    "templateId" TEXT,
    "processName" TEXT,
    "client" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "executionId" TEXT,
    "createdById" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "web_sdk_share_links_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "api_environments" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "web_sdk_share_links_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "validation_executions" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "web_sdk_share_links_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "messaging_config" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "smtpHost" TEXT,
    "smtpPort" INTEGER NOT NULL DEFAULT 587,
    "smtpSecure" BOOLEAN NOT NULL DEFAULT false,
    "smtpUserEnc" TEXT,
    "smtpPasswordEnc" TEXT,
    "fromAddress" TEXT,
    "fromName" TEXT NOT NULL DEFAULT 'FAD Biometrics Console',
    "whatsappApiBaseUrl" TEXT NOT NULL DEFAULT 'https://graph.facebook.com/v20.0',
    "whatsappPhoneNumberId" TEXT,
    "whatsappAccessTokenEnc" TEXT,
    "whatsappTemplateName" TEXT,
    "whatsappTemplateLanguage" TEXT NOT NULL DEFAULT 'es',
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "web_sdk_share_links_token_key" ON "web_sdk_share_links"("token");

-- CreateIndex
CREATE UNIQUE INDEX "web_sdk_share_links_executionId_key" ON "web_sdk_share_links"("executionId");

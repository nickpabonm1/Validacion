-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "api_environments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "environmentType" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "timeoutMs" INTEGER NOT NULL DEFAULT 15000,
    "maxRetries" INTEGER NOT NULL DEFAULT 2,
    "basicAuthUsernameEnc" TEXT,
    "basicAuthPasswordEnc" TEXT,
    "apiUsernameEnc" TEXT,
    "apiPasswordEnc" TEXT,
    "webhookUsernameEnc" TEXT,
    "webhookPasswordEnc" TEXT,
    "credentialsEncryptionVersion" INTEGER NOT NULL DEFAULT 1,
    "grantType" TEXT NOT NULL DEFAULT 'password',
    "passwordIsPreHashed" BOOLEAN NOT NULL DEFAULT false,
    "tokenRefreshMarginSeconds" INTEGER NOT NULL DEFAULT 60,
    "authTokenEndpoint" TEXT NOT NULL DEFAULT '/authorization-server/oauth/token',
    "createValidationEndpoint" TEXT NOT NULL DEFAULT '/biometrics-by-steps/validations',
    "saveValidationStepEndpoint" TEXT NOT NULL DEFAULT '/validation/saveValidationStep/{validationId}',
    "getValidationStepEndpoint" TEXT NOT NULL DEFAULT '/validation/getValidationStep/{validationId}',
    "getValidationStepHttpMethod" TEXT NOT NULL DEFAULT 'GET',
    "getValidationDataEndpoint" TEXT NOT NULL DEFAULT '/validation/validations/getValidationData/{validationId}',
    "launchUrlTemplate" TEXT,
    "webhookUrl" TEXT,
    "webhookActive" BOOLEAN NOT NULL DEFAULT false,
    "connectionStatus" TEXT NOT NULL DEFAULT 'NOT_CONFIGURED',
    "lastTestedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "provider_catalog_entries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "providerKey" TEXT NOT NULL,
    "providerLabel" TEXT NOT NULL,
    "providerType" TEXT NOT NULL,
    "externalProviderId" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "validation_templates" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "environmentId" TEXT,
    "requestConfig" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "validation_templates_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "api_environments" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "validation_templates_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "validation_templates_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "response_views" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'CUSTOM',
    "configuration" TEXT NOT NULL,
    "templateId" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "response_views_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "validation_templates" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "validation_executions" (
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

-- CreateTable
CREATE TABLE "validation_step_executions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "validationExecutionId" TEXT NOT NULL,
    "stepKey" TEXT NOT NULL,
    "externalStepId" TEXT,
    "order" INTEGER NOT NULL,
    "show" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "configuration" TEXT,
    "features" TEXT,
    "input" TEXT,
    "data" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    CONSTRAINT "validation_step_executions_validationExecutionId_fkey" FOREIGN KEY ("validationExecutionId") REFERENCES "validation_executions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "externalEventId" TEXT NOT NULL,
    "idOriginal" TEXT,
    "idUser" TEXT,
    "eventType" TEXT NOT NULL,
    "validationId" TEXT,
    "validationExecutionId" TEXT,
    "creationDateRaw" TEXT,
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retry" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "payload" TEXT NOT NULL,
    "processingStatus" TEXT NOT NULL DEFAULT 'RECEIVED',
    "processedAt" DATETIME,
    "processingError" TEXT,
    "uniqueHash" TEXT NOT NULL,
    CONSTRAINT "webhook_events_validationExecutionId_fkey" FOREIGN KEY ("validationExecutionId") REFERENCES "validation_executions" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "metadata" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "system_settings" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT,
    "encrypted" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "updatedById" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "system_settings_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "provider_catalog_entries_providerKey_key" ON "provider_catalog_entries"("providerKey");

-- CreateIndex
CREATE INDEX "validation_executions_validationId_idx" ON "validation_executions"("validationId");

-- CreateIndex
CREATE INDEX "validation_executions_normalizedStatus_idx" ON "validation_executions"("normalizedStatus");

-- CreateIndex
CREATE UNIQUE INDEX "validation_step_executions_validationExecutionId_stepKey_key" ON "validation_step_executions"("validationExecutionId", "stepKey");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_uniqueHash_key" ON "webhook_events"("uniqueHash");

-- CreateIndex
CREATE INDEX "webhook_events_eventType_idx" ON "webhook_events"("eventType");

-- CreateIndex
CREATE INDEX "webhook_events_validationId_idx" ON "webhook_events"("validationId");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

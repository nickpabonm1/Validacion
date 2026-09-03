-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "clientId" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentClientId" TEXT,
    "logoDataUrl" TEXT,
    "faviconDataUrl" TEXT,
    "primaryColor" TEXT,
    "emailSubjectTemplate" TEXT,
    "emailBodyTemplate" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_environments" (
    "id" TEXT NOT NULL,
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
    "lastTestedAt" TIMESTAMP(3),
    "integrationModel" TEXT NOT NULL DEFAULT 'API_BY_STEPS',
    "clientId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_environments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "web_sdk_configs" (
    "id" TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,
    "sdkBaseUrl" TEXT NOT NULL DEFAULT 'https://uathaapiframe.firmaautografa.com',
    "sdkRequestId" TEXT,
    "sdkTokenEnc" TEXT,
    "documentCaptureEngine" TEXT NOT NULL DEFAULT 'ACUANT',
    "acuantPassiveUsernameEnc" TEXT,
    "acuantPassivePasswordEnc" TEXT,
    "acuantPassiveSubscriptionIdEnc" TEXT,
    "acuantAcasEndpoint" TEXT NOT NULL DEFAULT 'https://eu.acas.acuant.net',
    "acuantLivenessEndpoint" TEXT NOT NULL DEFAULT 'https://eu.passlive.acuant.net',
    "acuantAssureidEndpoint" TEXT NOT NULL DEFAULT 'https://eu.assureid.acuant.net',
    "acuantParams" TEXT NOT NULL DEFAULT '{"idData":true,"idPhoto":true,"manualCapture":false}',
    "acuantConfiguration" TEXT NOT NULL DEFAULT '{}',
    "regulaLicenseEnc" TEXT,
    "regulaApiBasePath" TEXT,
    "regulaCaptureType" TEXT NOT NULL DEFAULT 'CAMERA_SNAPSHOT',
    "regulaParams" TEXT NOT NULL DEFAULT '{"idData":true,"idPhoto":true}',
    "regulaConfiguration" TEXT NOT NULL DEFAULT '{}',
    "captureIdParams" TEXT NOT NULL DEFAULT '{"idPhoto":true,"originalPhoto":false}',
    "captureIdConfiguration" TEXT NOT NULL DEFAULT '{}',
    "biometricEngine" TEXT NOT NULL DEFAULT 'FACETEC',
    "facetecUseMiddleware" BOOLEAN NOT NULL DEFAULT true,
    "facetecMiddleware" TEXT NOT NULL DEFAULT '{}',
    "facetecDeviceKeyIdentifierEnc" TEXT,
    "facetecPublicFaceScanEncryptionKeyEnc" TEXT,
    "facetecProductionKeyTextEnc" TEXT,
    "facetecConfiguration" TEXT NOT NULL DEFAULT '{}',
    "checkEndpoint" TEXT NOT NULL DEFAULT '/naat-check-api/idholo/multiple',
    "compareFacesEndpoint" TEXT NOT NULL DEFAULT '/biometrics/compareFacesPassive',
    "getValidationKeysEndpoint" TEXT NOT NULL DEFAULT '/validation/validations/getValidationKeys',
    "saveValidationDataEndpoint" TEXT NOT NULL DEFAULT '/validation/validations/saveValidationData',
    "checkMaxAttempts" INTEGER NOT NULL DEFAULT 3,
    "checkAcceptedRisk" TEXT NOT NULL DEFAULT 'LOW',
    "faceMatchMinConfidence" DOUBLE PRECISION NOT NULL DEFAULT 85,
    "onboardingMessages" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "web_sdk_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_catalog_entries" (
    "id" TEXT NOT NULL,
    "providerKey" TEXT NOT NULL,
    "providerLabel" TEXT NOT NULL,
    "providerType" TEXT NOT NULL,
    "externalProviderId" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_catalog_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "validation_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "environmentId" TEXT,
    "requestConfig" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "validation_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "response_views" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'CUSTOM',
    "configuration" TEXT NOT NULL,
    "templateId" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "response_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "validation_executions" (
    "id" TEXT NOT NULL,
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
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "validation_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "validation_step_executions" (
    "id" TEXT NOT NULL,
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
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "validation_step_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL,
    "externalEventId" TEXT NOT NULL,
    "idOriginal" TEXT,
    "idUser" TEXT,
    "eventType" TEXT NOT NULL,
    "validationId" TEXT,
    "validationExecutionId" TEXT,
    "creationDateRaw" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retry" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "payload" TEXT NOT NULL,
    "processingStatus" TEXT NOT NULL DEFAULT 'RECEIVED',
    "processedAt" TIMESTAMP(3),
    "processingError" TEXT,
    "uniqueHash" TEXT NOT NULL,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "metadata" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "key" TEXT NOT NULL,
    "value" TEXT,
    "encrypted" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "web_sdk_share_links" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,
    "templateId" TEXT,
    "processName" TEXT,
    "client" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "executionId" TEXT,
    "createdById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "web_sdk_share_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messaging_config" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
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
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "messaging_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_check_scoring_config" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "categoryWeights" TEXT NOT NULL DEFAULT '{}',
    "passThreshold" INTEGER,
    "treatNotDoneAsFailure" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_check_scoring_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "database_connection_config" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "engine" TEXT NOT NULL DEFAULT 'SQLITE',
    "host" TEXT,
    "port" INTEGER,
    "databaseName" TEXT,
    "username" TEXT,
    "passwordEnc" TEXT,
    "ssl" BOOLEAN NOT NULL DEFAULT true,
    "connectionUri" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "database_connection_config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "web_sdk_configs_environmentId_key" ON "web_sdk_configs"("environmentId");

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

-- CreateIndex
CREATE UNIQUE INDEX "web_sdk_share_links_token_key" ON "web_sdk_share_links"("token");

-- CreateIndex
CREATE UNIQUE INDEX "web_sdk_share_links_executionId_key" ON "web_sdk_share_links"("executionId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_parentClientId_fkey" FOREIGN KEY ("parentClientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_environments" ADD CONSTRAINT "api_environments_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "web_sdk_configs" ADD CONSTRAINT "web_sdk_configs_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "api_environments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validation_templates" ADD CONSTRAINT "validation_templates_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "api_environments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validation_templates" ADD CONSTRAINT "validation_templates_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validation_templates" ADD CONSTRAINT "validation_templates_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "response_views" ADD CONSTRAINT "response_views_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "validation_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validation_executions" ADD CONSTRAINT "validation_executions_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "api_environments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validation_executions" ADD CONSTRAINT "validation_executions_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "validation_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validation_executions" ADD CONSTRAINT "validation_executions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validation_step_executions" ADD CONSTRAINT "validation_step_executions_validationExecutionId_fkey" FOREIGN KEY ("validationExecutionId") REFERENCES "validation_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_validationExecutionId_fkey" FOREIGN KEY ("validationExecutionId") REFERENCES "validation_executions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "web_sdk_share_links" ADD CONSTRAINT "web_sdk_share_links_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "api_environments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "web_sdk_share_links" ADD CONSTRAINT "web_sdk_share_links_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "validation_executions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "web_sdk_share_links" ADD CONSTRAINT "web_sdk_share_links_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

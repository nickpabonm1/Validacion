-- AlterTable
ALTER TABLE "validation_executions" ADD COLUMN "webSdkState" TEXT;

-- CreateTable
CREATE TABLE "web_sdk_configs" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "faceMatchMinConfidence" REAL NOT NULL DEFAULT 85,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "web_sdk_configs_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "api_environments" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_api_environments" (
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
    "integrationModel" TEXT NOT NULL DEFAULT 'API_BY_STEPS',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_api_environments" ("active", "apiPasswordEnc", "apiUsernameEnc", "authTokenEndpoint", "baseUrl", "basicAuthPasswordEnc", "basicAuthUsernameEnc", "connectionStatus", "createValidationEndpoint", "createdAt", "credentialsEncryptionVersion", "description", "environmentType", "getValidationDataEndpoint", "getValidationStepEndpoint", "getValidationStepHttpMethod", "grantType", "id", "lastTestedAt", "launchUrlTemplate", "maxRetries", "name", "passwordIsPreHashed", "saveValidationStepEndpoint", "timeoutMs", "tokenRefreshMarginSeconds", "updatedAt", "webhookActive", "webhookPasswordEnc", "webhookUrl", "webhookUsernameEnc") SELECT "active", "apiPasswordEnc", "apiUsernameEnc", "authTokenEndpoint", "baseUrl", "basicAuthPasswordEnc", "basicAuthUsernameEnc", "connectionStatus", "createValidationEndpoint", "createdAt", "credentialsEncryptionVersion", "description", "environmentType", "getValidationDataEndpoint", "getValidationStepEndpoint", "getValidationStepHttpMethod", "grantType", "id", "lastTestedAt", "launchUrlTemplate", "maxRetries", "name", "passwordIsPreHashed", "saveValidationStepEndpoint", "timeoutMs", "tokenRefreshMarginSeconds", "updatedAt", "webhookActive", "webhookPasswordEnc", "webhookUrl", "webhookUsernameEnc" FROM "api_environments";
DROP TABLE "api_environments";
ALTER TABLE "new_api_environments" RENAME TO "api_environments";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "web_sdk_configs_environmentId_key" ON "web_sdk_configs"("environmentId");

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "parentClientId" TEXT,
    "logoDataUrl" TEXT,
    "faviconDataUrl" TEXT,
    "primaryColor" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "clients_parentClientId_fkey" FOREIGN KEY ("parentClientId") REFERENCES "clients" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
    "clientId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "api_environments_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_api_environments" ("active", "apiPasswordEnc", "apiUsernameEnc", "authTokenEndpoint", "baseUrl", "basicAuthPasswordEnc", "basicAuthUsernameEnc", "connectionStatus", "createValidationEndpoint", "createdAt", "credentialsEncryptionVersion", "description", "environmentType", "getValidationDataEndpoint", "getValidationStepEndpoint", "getValidationStepHttpMethod", "grantType", "id", "integrationModel", "lastTestedAt", "launchUrlTemplate", "maxRetries", "name", "passwordIsPreHashed", "saveValidationStepEndpoint", "timeoutMs", "tokenRefreshMarginSeconds", "updatedAt", "webhookActive", "webhookPasswordEnc", "webhookUrl", "webhookUsernameEnc") SELECT "active", "apiPasswordEnc", "apiUsernameEnc", "authTokenEndpoint", "baseUrl", "basicAuthPasswordEnc", "basicAuthUsernameEnc", "connectionStatus", "createValidationEndpoint", "createdAt", "credentialsEncryptionVersion", "description", "environmentType", "getValidationDataEndpoint", "getValidationStepEndpoint", "getValidationStepHttpMethod", "grantType", "id", "integrationModel", "lastTestedAt", "launchUrlTemplate", "maxRetries", "name", "passwordIsPreHashed", "saveValidationStepEndpoint", "timeoutMs", "tokenRefreshMarginSeconds", "updatedAt", "webhookActive", "webhookPasswordEnc", "webhookUrl", "webhookUsernameEnc" FROM "api_environments";
DROP TABLE "api_environments";
ALTER TABLE "new_api_environments" RENAME TO "api_environments";
CREATE TABLE "new_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "clientId" TEXT,
    CONSTRAINT "users_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_users" ("active", "createdAt", "email", "id", "name", "passwordHash", "role", "updatedAt") SELECT "active", "createdAt", "email", "id", "name", "passwordHash", "role", "updatedAt" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

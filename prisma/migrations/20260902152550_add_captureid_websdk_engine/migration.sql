-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_web_sdk_configs" (
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
    "faceMatchMinConfidence" REAL NOT NULL DEFAULT 85,
    "onboardingMessages" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "web_sdk_configs_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "api_environments" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_web_sdk_configs" ("acuantAcasEndpoint", "acuantAssureidEndpoint", "acuantConfiguration", "acuantLivenessEndpoint", "acuantParams", "acuantPassivePasswordEnc", "acuantPassiveSubscriptionIdEnc", "acuantPassiveUsernameEnc", "biometricEngine", "checkAcceptedRisk", "checkEndpoint", "checkMaxAttempts", "compareFacesEndpoint", "createdAt", "documentCaptureEngine", "environmentId", "faceMatchMinConfidence", "facetecConfiguration", "facetecDeviceKeyIdentifierEnc", "facetecMiddleware", "facetecProductionKeyTextEnc", "facetecPublicFaceScanEncryptionKeyEnc", "facetecUseMiddleware", "getValidationKeysEndpoint", "id", "onboardingMessages", "regulaApiBasePath", "regulaCaptureType", "regulaConfiguration", "regulaLicenseEnc", "regulaParams", "saveValidationDataEndpoint", "sdkBaseUrl", "sdkRequestId", "sdkTokenEnc", "updatedAt") SELECT "acuantAcasEndpoint", "acuantAssureidEndpoint", "acuantConfiguration", "acuantLivenessEndpoint", "acuantParams", "acuantPassivePasswordEnc", "acuantPassiveSubscriptionIdEnc", "acuantPassiveUsernameEnc", "biometricEngine", "checkAcceptedRisk", "checkEndpoint", "checkMaxAttempts", "compareFacesEndpoint", "createdAt", "documentCaptureEngine", "environmentId", "faceMatchMinConfidence", "facetecConfiguration", "facetecDeviceKeyIdentifierEnc", "facetecMiddleware", "facetecProductionKeyTextEnc", "facetecPublicFaceScanEncryptionKeyEnc", "facetecUseMiddleware", "getValidationKeysEndpoint", "id", "onboardingMessages", "regulaApiBasePath", "regulaCaptureType", "regulaConfiguration", "regulaLicenseEnc", "regulaParams", "saveValidationDataEndpoint", "sdkBaseUrl", "sdkRequestId", "sdkTokenEnc", "updatedAt" FROM "web_sdk_configs";
DROP TABLE "web_sdk_configs";
ALTER TABLE "new_web_sdk_configs" RENAME TO "web_sdk_configs";
CREATE UNIQUE INDEX "web_sdk_configs_environmentId_key" ON "web_sdk_configs"("environmentId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

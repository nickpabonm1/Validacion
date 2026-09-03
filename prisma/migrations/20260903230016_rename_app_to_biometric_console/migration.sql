-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_messaging_config" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "smtpHost" TEXT,
    "smtpPort" INTEGER NOT NULL DEFAULT 587,
    "smtpSecure" BOOLEAN NOT NULL DEFAULT false,
    "smtpUserEnc" TEXT,
    "smtpPasswordEnc" TEXT,
    "fromAddress" TEXT,
    "fromName" TEXT NOT NULL DEFAULT 'Biometric Console',
    "whatsappApiBaseUrl" TEXT NOT NULL DEFAULT 'https://graph.facebook.com/v20.0',
    "whatsappPhoneNumberId" TEXT,
    "whatsappAccessTokenEnc" TEXT,
    "whatsappTemplateName" TEXT,
    "whatsappTemplateLanguage" TEXT NOT NULL DEFAULT 'es',
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_messaging_config" ("fromAddress", "fromName", "id", "smtpHost", "smtpPasswordEnc", "smtpPort", "smtpSecure", "smtpUserEnc", "updatedAt", "whatsappAccessTokenEnc", "whatsappApiBaseUrl", "whatsappPhoneNumberId", "whatsappTemplateLanguage", "whatsappTemplateName") SELECT "fromAddress", "fromName", "id", "smtpHost", "smtpPasswordEnc", "smtpPort", "smtpSecure", "smtpUserEnc", "updatedAt", "whatsappAccessTokenEnc", "whatsappApiBaseUrl", "whatsappPhoneNumberId", "whatsappTemplateLanguage", "whatsappTemplateName" FROM "messaging_config";
DROP TABLE "messaging_config";
ALTER TABLE "new_messaging_config" RENAME TO "messaging_config";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

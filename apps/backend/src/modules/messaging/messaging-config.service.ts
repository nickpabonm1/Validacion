import type { MessagingConfigDto } from "@fad-console/shared-types";
import type { MessagingConfigInput } from "@fad-console/validation-schemas";
import { prisma } from "../../lib/prisma";
import { credentialEncryptionService } from "../credentials/credential-encryption.service";

const SINGLETON_ID = "singleton";

type MessagingConfigRecord = Awaited<ReturnType<typeof prisma.messagingConfig.upsert>>;

export function toMessagingConfigDto(config: MessagingConfigRecord): MessagingConfigDto {
  return {
    smtpHost: config.smtpHost,
    smtpPort: config.smtpPort,
    smtpSecure: config.smtpSecure,
    smtpUserConfigured: credentialEncryptionService.isConfigured(config.smtpUserEnc),
    smtpPasswordConfigured: credentialEncryptionService.isConfigured(config.smtpPasswordEnc),
    fromAddress: config.fromAddress,
    fromName: config.fromName,

    whatsappApiBaseUrl: config.whatsappApiBaseUrl,
    whatsappPhoneNumberId: config.whatsappPhoneNumberId,
    whatsappAccessTokenConfigured: credentialEncryptionService.isConfigured(config.whatsappAccessTokenEnc),
    whatsappTemplateName: config.whatsappTemplateName,
    whatsappTemplateLanguage: config.whatsappTemplateLanguage,

    updatedAt: config.updatedAt.toISOString(),
  };
}

/** Crea la fila singleton con valores por defecto si aún no existe (primer acceso). */
export async function getMessagingConfig() {
  return prisma.messagingConfig.upsert({
    where: { id: SINGLETON_ID },
    update: {},
    create: { id: SINGLETON_ID },
  });
}

export async function upsertMessagingConfig(input: MessagingConfigInput) {
  const shared = {
    smtpHost: input.smtpHost ?? null,
    smtpPort: input.smtpPort,
    smtpSecure: input.smtpSecure,
    fromAddress: input.fromAddress ?? null,
    fromName: input.fromName,
    whatsappApiBaseUrl: input.whatsappApiBaseUrl,
    whatsappPhoneNumberId: input.whatsappPhoneNumberId ?? null,
    whatsappTemplateName: input.whatsappTemplateName ?? null,
    whatsappTemplateLanguage: input.whatsappTemplateLanguage,
  };
  const encrypted = {
    smtpUserEnc: credentialEncryptionService.encryptIfPresent(input.smtpUser),
    smtpPasswordEnc: credentialEncryptionService.encryptIfPresent(input.smtpPassword),
    whatsappAccessTokenEnc: credentialEncryptionService.encryptIfPresent(input.whatsappAccessToken),
  };

  return prisma.messagingConfig.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID, ...shared, ...encrypted },
    update: { ...shared, ...encrypted },
  });
}

/** Decodifica las credenciales de mensajería para uso interno de `email.service`/
 * `whatsapp.service` — nunca expuesto vía DTO. */
export function decryptMessagingCredentials(config: MessagingConfigRecord) {
  return {
    smtpUser: credentialEncryptionService.decryptOrNull(config.smtpUserEnc),
    smtpPassword: credentialEncryptionService.decryptOrNull(config.smtpPasswordEnc),
    whatsappAccessToken: credentialEncryptionService.decryptOrNull(config.whatsappAccessTokenEnc),
  };
}

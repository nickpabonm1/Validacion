import type { NaatCheckConfigDto, RiskLevel } from "@fad-console/shared-types";
import type { NaatCheckConfigInput } from "@fad-console/validation-schemas";
import { prisma } from "../../lib/prisma";
import { credentialEncryptionService } from "../credentials/credential-encryption.service";

type NaatCheckConfigRecord = Awaited<ReturnType<typeof prisma.naatCheckConfig.findFirstOrThrow>>;

export function toNaatCheckConfigDto(config: NaatCheckConfigRecord): NaatCheckConfigDto {
  return {
    environmentId: config.environmentId,
    enabled: config.enabled,
    baseUrl: config.baseUrl,
    username: credentialEncryptionService.decryptOrNull(config.usernameEnc),
    passwordConfigured: credentialEncryptionService.isConfigured(config.passwordEnc),
    acceptedRiskLevel: config.acceptedRiskLevel as RiskLevel,
    webhookUsernameConfigured: credentialEncryptionService.isConfigured(config.webhookUsernameEnc),
    webhookPasswordConfigured: credentialEncryptionService.isConfigured(config.webhookPasswordEnc),
    updatedAt: config.updatedAt.toISOString(),
  };
}

export async function getNaatCheckConfig(environmentId: string) {
  return prisma.naatCheckConfig.findUnique({ where: { environmentId } });
}

/** Crea o reemplaza la configuración NAAT-CHECK de un ambiente (upsert por `environmentId`). Un
 * campo de credencial vacío/ausente en `input` = "no cambiar" (mismo criterio que
 * `ApiEnvironment`/`WebSdkConfig`/`MessagingConfig`). */
export async function upsertNaatCheckConfig(environmentId: string, input: NaatCheckConfigInput) {
  const shared = {
    enabled: input.enabled,
    baseUrl: input.baseUrl,
    acceptedRiskLevel: input.acceptedRiskLevel,
  };
  const encrypted = {
    usernameEnc: input.username ? credentialEncryptionService.encrypt(input.username) : undefined,
    passwordEnc: credentialEncryptionService.encryptIfPresent(input.password),
    webhookUsernameEnc: input.webhookUsername ? credentialEncryptionService.encrypt(input.webhookUsername) : undefined,
    webhookPasswordEnc: credentialEncryptionService.encryptIfPresent(input.webhookPassword),
  };

  return prisma.naatCheckConfig.upsert({
    where: { environmentId },
    create: { environmentId, ...shared, ...encrypted },
    update: { ...shared, ...encrypted },
  });
}

export function decryptNaatCheckCredentials(config: NaatCheckConfigRecord) {
  return {
    username: credentialEncryptionService.decryptOrNull(config.usernameEnc),
    password: credentialEncryptionService.decryptOrNull(config.passwordEnc),
  };
}

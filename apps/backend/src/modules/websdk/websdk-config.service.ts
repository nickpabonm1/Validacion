import type { WebSdkConfigDto, DocumentCaptureEngine, BiometricEngine, RiskLevel } from "@fad-console/shared-types";
import type { WebSdkConfigInput } from "@fad-console/validation-schemas";
import { DEFAULT_ONBOARDING_MESSAGES } from "@fad-console/validation-schemas";
import { prisma } from "../../lib/prisma";
import { fromJsonField, toJsonField } from "../../lib/json-field";
import { credentialEncryptionService } from "../credentials/credential-encryption.service";

type WebSdkConfigRecord = Awaited<ReturnType<typeof prisma.webSdkConfig.findFirstOrThrow>>;

export function toWebSdkConfigDto(config: WebSdkConfigRecord): WebSdkConfigDto {
  return {
    environmentId: config.environmentId,
    sdkBaseUrl: config.sdkBaseUrl,
    sdkRequestId: config.sdkRequestId,
    sdkTokenConfigured: credentialEncryptionService.isConfigured(config.sdkTokenEnc),

    documentCaptureEngine: config.documentCaptureEngine as DocumentCaptureEngine,
    acuantPassiveUsernameConfigured: credentialEncryptionService.isConfigured(config.acuantPassiveUsernameEnc),
    acuantPassivePasswordConfigured: credentialEncryptionService.isConfigured(config.acuantPassivePasswordEnc),
    acuantPassiveSubscriptionIdConfigured: credentialEncryptionService.isConfigured(
      config.acuantPassiveSubscriptionIdEnc,
    ),
    acuantAcasEndpoint: config.acuantAcasEndpoint,
    acuantLivenessEndpoint: config.acuantLivenessEndpoint,
    acuantAssureidEndpoint: config.acuantAssureidEndpoint,
    acuantParams: fromJsonField(config.acuantParams, { idData: true, idPhoto: true, manualCapture: false }),
    acuantConfiguration: fromJsonField(config.acuantConfiguration, {}),

    biometricEngine: config.biometricEngine as BiometricEngine,
    facetecUseMiddleware: config.facetecUseMiddleware,
    facetecMiddleware: fromJsonField(config.facetecMiddleware, {}),
    facetecDeviceKeyIdentifierConfigured: credentialEncryptionService.isConfigured(
      config.facetecDeviceKeyIdentifierEnc,
    ),
    facetecPublicFaceScanEncryptionKeyConfigured: credentialEncryptionService.isConfigured(
      config.facetecPublicFaceScanEncryptionKeyEnc,
    ),
    facetecProductionKeyTextConfigured: credentialEncryptionService.isConfigured(
      config.facetecProductionKeyTextEnc,
    ),
    facetecConfiguration: fromJsonField(config.facetecConfiguration, {}),

    checkEndpoint: config.checkEndpoint,
    compareFacesEndpoint: config.compareFacesEndpoint,
    getValidationKeysEndpoint: config.getValidationKeysEndpoint,
    saveValidationDataEndpoint: config.saveValidationDataEndpoint,

    checkMaxAttempts: config.checkMaxAttempts,
    checkAcceptedRisk: config.checkAcceptedRisk as RiskLevel,
    faceMatchMinConfidence: config.faceMatchMinConfidence,

    onboardingMessages: {
      ...DEFAULT_ONBOARDING_MESSAGES,
      ...fromJsonField(config.onboardingMessages, {}),
    },

    createdAt: config.createdAt.toISOString(),
    updatedAt: config.updatedAt.toISOString(),
  };
}

export async function getWebSdkConfig(environmentId: string) {
  return prisma.webSdkConfig.findUnique({ where: { environmentId } });
}

function buildEncryptedFields(input: WebSdkConfigInput) {
  return {
    sdkTokenEnc: credentialEncryptionService.encryptIfPresent(input.sdkToken),
    acuantPassiveUsernameEnc: credentialEncryptionService.encryptIfPresent(input.acuantPassiveUsername),
    acuantPassivePasswordEnc: credentialEncryptionService.encryptIfPresent(input.acuantPassivePassword),
    acuantPassiveSubscriptionIdEnc: credentialEncryptionService.encryptIfPresent(input.acuantPassiveSubscriptionId),
    facetecDeviceKeyIdentifierEnc: credentialEncryptionService.encryptIfPresent(input.facetecDeviceKeyIdentifier),
    facetecPublicFaceScanEncryptionKeyEnc: credentialEncryptionService.encryptIfPresent(
      input.facetecPublicFaceScanEncryptionKey,
    ),
    facetecProductionKeyTextEnc: input.facetecProductionKeyText
      ? credentialEncryptionService.encrypt(JSON.stringify(input.facetecProductionKeyText))
      : undefined,
  };
}

/** Crea o reemplaza la configuración Web SDK de un ambiente (upsert por `environmentId`). */
export async function upsertWebSdkConfig(environmentId: string, input: WebSdkConfigInput) {
  const encrypted = buildEncryptedFields(input);
  const shared = {
    sdkBaseUrl: input.sdkBaseUrl,
    sdkRequestId: input.sdkRequestId ?? null,
    documentCaptureEngine: input.documentCaptureEngine,
    acuantAcasEndpoint: input.acuantAcasEndpoint,
    acuantLivenessEndpoint: input.acuantLivenessEndpoint,
    acuantAssureidEndpoint: input.acuantAssureidEndpoint,
    acuantParams: toJsonField(input.acuantParams),
    acuantConfiguration: toJsonField(input.acuantConfiguration),
    biometricEngine: input.biometricEngine,
    facetecUseMiddleware: input.facetecUseMiddleware,
    facetecMiddleware: toJsonField(input.facetecMiddleware),
    facetecConfiguration: toJsonField(input.facetecConfiguration),
    checkEndpoint: input.checkEndpoint,
    compareFacesEndpoint: input.compareFacesEndpoint,
    getValidationKeysEndpoint: input.getValidationKeysEndpoint,
    saveValidationDataEndpoint: input.saveValidationDataEndpoint,
    checkMaxAttempts: input.checkMaxAttempts,
    checkAcceptedRisk: input.checkAcceptedRisk,
    faceMatchMinConfidence: input.faceMatchMinConfidence,
    onboardingMessages: toJsonField(input.onboardingMessages),
  };

  return prisma.webSdkConfig.upsert({
    where: { environmentId },
    create: { environmentId, ...shared, ...encrypted },
    update: { ...shared, ...encrypted },
  });
}

const CREDENTIAL_FIELD_MAP = {
  sdkToken: "sdkTokenEnc",
  acuantPassiveUsername: "acuantPassiveUsernameEnc",
  acuantPassivePassword: "acuantPassivePasswordEnc",
  acuantPassiveSubscriptionId: "acuantPassiveSubscriptionIdEnc",
  facetecDeviceKeyIdentifier: "facetecDeviceKeyIdentifierEnc",
  facetecPublicFaceScanEncryptionKey: "facetecPublicFaceScanEncryptionKeyEnc",
  facetecProductionKeyText: "facetecProductionKeyTextEnc",
} as const;

export type WebSdkCredentialFieldKey = keyof typeof CREDENTIAL_FIELD_MAP;

export async function clearWebSdkCredentialField(environmentId: string, field: WebSdkCredentialFieldKey) {
  const column = CREDENTIAL_FIELD_MAP[field];
  return prisma.webSdkConfig.update({ where: { environmentId }, data: { [column]: null } });
}

/** Decodifica las credenciales necesarias para iniciar el SDK en el navegador (uso interno del
 * módulo `websdk-flow`, nunca expuesto directamente vía DTO). */
export function decryptWebSdkCredentials(config: WebSdkConfigRecord) {
  return {
    sdkToken: credentialEncryptionService.decryptOrNull(config.sdkTokenEnc),
    acuantPassiveUsername: credentialEncryptionService.decryptOrNull(config.acuantPassiveUsernameEnc),
    acuantPassivePassword: credentialEncryptionService.decryptOrNull(config.acuantPassivePasswordEnc),
    acuantPassiveSubscriptionId: credentialEncryptionService.decryptOrNull(config.acuantPassiveSubscriptionIdEnc),
    facetecDeviceKeyIdentifier: credentialEncryptionService.decryptOrNull(config.facetecDeviceKeyIdentifierEnc),
    facetecPublicFaceScanEncryptionKey: credentialEncryptionService.decryptOrNull(
      config.facetecPublicFaceScanEncryptionKeyEnc,
    ),
    facetecProductionKeyText: config.facetecProductionKeyTextEnc
      ? (JSON.parse(credentialEncryptionService.decrypt(config.facetecProductionKeyTextEnc)) as {
          domains: string;
          expiryDate: string;
          key: string;
        })
      : null,
  };
}

import { z } from "zod";
import { DOCUMENT_CAPTURE_ENGINES, BIOMETRIC_ENGINES, RISK_LEVELS } from "@fad-console/shared-types";

/**
 * Configuración del modelo de integración "Web SDK" (ver prisma/schema.prisma `WebSdkConfig` y
 * docs/websdk-integration.md). Los campos de credenciales son opcionales aquí: vacío = "no
 * cambiar" en una edición, igual que en `ApiEnvironmentInputSchema`.
 */
export const WebSdkConfigInputSchema = z.object({
  sdkBaseUrl: z.string().url("Debe ser una URL válida").default("https://uathaapiframe.firmaautografa.com"),
  sdkRequestId: z.string().max(120).optional().nullable(),
  sdkToken: z.string().max(2000).optional(),

  documentCaptureEngine: z.enum(DOCUMENT_CAPTURE_ENGINES).default("ACUANT"),
  acuantPassiveUsername: z.string().max(200).optional(),
  acuantPassivePassword: z.string().max(500).optional(),
  acuantPassiveSubscriptionId: z.string().max(200).optional(),
  acuantAcasEndpoint: z.string().url().default("https://eu.acas.acuant.net"),
  acuantLivenessEndpoint: z.string().url().default("https://eu.passlive.acuant.net"),
  acuantAssureidEndpoint: z.string().url().default("https://eu.assureid.acuant.net"),
  acuantParams: z
    .object({ idData: z.boolean(), idPhoto: z.boolean(), manualCapture: z.boolean() })
    .default({ idData: true, idPhoto: true, manualCapture: false }),
  acuantConfiguration: z.record(z.unknown()).default({}),

  biometricEngine: z.enum(BIOMETRIC_ENGINES).default("FACETEC"),
  facetecUseMiddleware: z.boolean().default(true),
  facetecMiddleware: z.record(z.unknown()).default({}),
  facetecDeviceKeyIdentifier: z.string().max(500).optional(),
  facetecPublicFaceScanEncryptionKey: z.string().max(4000).optional(),
  facetecProductionKeyText: z
    .object({ domains: z.string(), expiryDate: z.string(), key: z.string() })
    .optional(),
  facetecConfiguration: z.record(z.unknown()).default({}),

  checkEndpoint: z.string().min(1).default("/naat-check-api/idholo/multiple"),
  compareFacesEndpoint: z.string().min(1).default("/biometrics/compareFacesPassive"),
  getValidationKeysEndpoint: z.string().min(1).default("/validation/validations/getValidationKeys"),
  saveValidationDataEndpoint: z.string().min(1).default("/validation/validations/saveValidationData"),

  checkMaxAttempts: z.number().int().min(1).max(10).default(3),
  checkAcceptedRisk: z.enum(RISK_LEVELS).default("LOW"),
  faceMatchMinConfidence: z.number().min(0).max(100).default(85),
});
export type WebSdkConfigInput = z.infer<typeof WebSdkConfigInputSchema>;

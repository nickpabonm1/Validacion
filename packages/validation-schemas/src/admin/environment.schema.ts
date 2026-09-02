import { z } from "zod";
import { ENVIRONMENT_TYPES, HTTP_METHODS, INTEGRATION_MODELS } from "@fad-console/shared-types";

const SECURE_URL = z
  .string()
  .url("Debe ser una URL válida")
  .refine(
    (url) => url.startsWith("https://") || url.startsWith("http://localhost") || url.startsWith("http://127.0.0.1"),
    "La URL debe usar https (se permite http solo en localhost para desarrollo)",
  );

/** Datos generales + endpoints + webhooks de un ApiEnvironment. Los campos de credenciales
 * (`basicAuthPassword`, `apiPassword`, `webhookPassword`) son opcionales aquí: vacío = "no
 * cambiar" en una edición (ver docs/security-decisions.md). */
export const ApiEnvironmentInputSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio").max(120),
  description: z.string().max(500).optional().nullable(),
  environmentType: z.enum(ENVIRONMENT_TYPES),
  baseUrl: SECURE_URL,
  active: z.boolean().default(true),
  timeoutMs: z.number().int().min(1000).max(120000).default(15000),
  maxRetries: z.number().int().min(0).max(5).default(2),

  basicAuthUsername: z.string().max(200).optional(),
  basicAuthPassword: z.string().max(500).optional(),
  apiUsername: z.string().max(200).optional(),
  apiPassword: z.string().max(500).optional(),
  grantType: z.string().min(1).max(60).default("password"),
  passwordIsPreHashed: z.boolean().default(false),
  tokenRefreshMarginSeconds: z.number().int().min(0).max(3600).default(60),

  authTokenEndpoint: z.string().min(1).default("/authorization-server/oauth/token"),
  createValidationEndpoint: z.string().min(1).default("/biometrics-by-steps/validations"),
  // Estos 3 endpoints se consultan una vez por validationId (ver FadApiAdapter.withValidationId,
  // que hace `.replace("{validationId}", ...)`): si el operador pega aquí una URL de ejemplo ya
  // resuelta (copiada de Postman, con un ID real en vez del placeholder), TODAS las ejecuciones
  // terminan consultando esa misma validación fija — un error real detectado en producción que
  // FAD reporta como "la validation no existe" para cualquier ejecución. Se exige el placeholder
  // literal para que este error de configuración se detecte al guardar, no en cada sincronización.
  saveValidationStepEndpoint: z
    .string()
    .min(1)
    .refine((v) => v.includes("{validationId}"), "Debe incluir el placeholder literal {validationId}")
    .default("/validation/saveValidationStep/{validationId}"),
  getValidationStepEndpoint: z
    .string()
    .min(1)
    .refine((v) => v.includes("{validationId}"), "Debe incluir el placeholder literal {validationId}")
    .default("/validation/getValidationStep/{validationId}"),
  getValidationStepHttpMethod: z.enum(HTTP_METHODS).default("GET"),
  getValidationDataEndpoint: z
    .string()
    .min(1)
    .refine((v) => v.includes("{validationId}"), "Debe incluir el placeholder literal {validationId}")
    .default("/validation/validations/getValidationData/{validationId}"),
  launchUrlTemplate: z.string().max(500).optional().nullable(),

  webhookUsername: z.string().max(200).optional(),
  webhookPassword: z.string().max(500).optional(),
  webhookUrl: z.string().max(500).optional().nullable(),
  webhookActive: z.boolean().default(false),

  integrationModel: z.enum(INTEGRATION_MODELS).default("API_BY_STEPS"),
});
export type ApiEnvironmentInput = z.infer<typeof ApiEnvironmentInputSchema>;

export const ProviderCatalogEntryInputSchema = z.object({
  providerKey: z.string().min(1).max(60),
  providerLabel: z.string().min(1).max(120),
  providerType: z.string().min(1).max(60),
  externalProviderId: z.number().int(),
  enabled: z.boolean().default(true),
  metadata: z.record(z.unknown()).default({}),
});
export type ProviderCatalogEntryInput = z.infer<typeof ProviderCatalogEntryInputSchema>;

import { z } from "zod";
import { DOCUMENT_CAPTURE_ENGINES, BIOMETRIC_ENGINES, RISK_LEVELS, REGULA_CAPTURE_TYPES } from "@fad-console/shared-types";

/**
 * Copy configurable del front de onboarding Web SDK (`WebSdkCapturePage`), de cara al cliente
 * final — nunca contiene secretos. Todos los campos tienen un valor por defecto en español
 * neutro, así que un ambiente recién creado ya muestra un onboarding funcional sin que el
 * operador tenga que escribir texto antes de poder probarlo.
 */
export const WebSdkOnboardingMessagesSchema = z.object({
  welcomeTitle: z.string().max(200).default("Vamos a verificar tu identidad"),
  welcomeBody: z
    .string()
    .max(2000)
    .default("En unos minutos tomarás una foto de tu identificación oficial y una selfie. Ten tu documento a la mano."),
  documentTitle: z.string().max(200).default("Foto de tu identificación"),
  documentBody: z
    .string()
    .max(2000)
    .default("Coloca tu documento dentro del marco, evita reflejos y asegúrate de que el texto se vea nítido."),
  documentRetryBody: z
    .string()
    .max(2000)
    .default("No pudimos validar tu documento. Vuelve a intentarlo con buena iluminación y sin brillos ni reflejos."),
  livenessTitle: z.string().max(200).default("Prueba de vida"),
  livenessBody: z.string().max(2000).default("Mira directamente a la cámara y sigue las instrucciones en pantalla."),
  completingTitle: z.string().max(200).default("Estamos verificando tu información"),
  completingBody: z.string().max(2000).default("Esto solo tomará unos segundos, no cierres esta ventana."),
  successTitle: z.string().max(200).default("¡Listo!"),
  successBody: z.string().max(2000).default("Tu identidad fue verificada correctamente."),
  blockedTitle: z.string().max(200).default("No pudimos verificar tu identidad"),
  blockedBody: z
    .string()
    .max(2000)
    .default("Se agotaron los intentos permitidos. Por favor contacta a soporte para continuar."),
  genericErrorBody: z.string().max(2000).default("Ocurrió un problema durante la verificación. Intenta de nuevo."),
});
export type WebSdkOnboardingMessages = z.infer<typeof WebSdkOnboardingMessagesSchema>;

/** Valores por defecto ya resueltos (útil en el backend para completar filas creadas antes de
 * que este campo existiera, o guardadas con un subconjunto de mensajes). */
export const DEFAULT_ONBOARDING_MESSAGES: WebSdkOnboardingMessages = WebSdkOnboardingMessagesSchema.parse({});

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

  /** Licencia de Regula, provista en Base64 por el equipo de NA-AT Tech (ver "FAD SDK Web
   * Regula" §Credentials) — opcional aquí: vacío = "no cambiar" en una edición. */
  regulaLicense: z.string().max(8000).optional(),
  /** URL interna del proveedor Regula ("The apiBasePath must always be an internal URL"). */
  regulaApiBasePath: z.string().url().optional().nullable(),
  /** RegulaCaptureType: DOCUMENT_READER | CAMERA_SNAPSHOT | DESKTOP. */
  regulaCaptureType: z.enum(REGULA_CAPTURE_TYPES).default("CAMERA_SNAPSHOT"),
  regulaParams: z.object({ idData: z.boolean(), idPhoto: z.boolean() }).default({ idData: true, idPhoto: true }),
  /** Objeto CONFIGURATION de startRegula (colores/leyendas/vistas) — no contiene secretos. */
  regulaConfiguration: z.record(z.unknown()).default({}),

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

  onboardingMessages: WebSdkOnboardingMessagesSchema.default({}),
});
export type WebSdkConfigInput = z.infer<typeof WebSdkConfigInputSchema>;

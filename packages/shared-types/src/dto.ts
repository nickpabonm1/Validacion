import type { EnvironmentType, UserRole, ConfigurableHttpMethod, IntegrationModel, DocumentCaptureEngine, BiometricEngine, RiskLevel, RegulaCaptureType } from "./enums";
import type { NormalizedValidationDetail } from "./normalized";

export interface AuthenticatedUserDto {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
  /** `null` = usuario de plataforma (acceso global). Con un cliente asignado, la sesión queda
   * confinada a ese cliente y a sus hijos — ver `ClientDto`. */
  clientId: string | null;
}

/**
 * Representación pública de un ApiEnvironment: NUNCA incluye secretos, solo banderas
 * `*Configured`. Ver docs/security-decisions.md.
 */
export interface ApiEnvironmentDto {
  id: string;
  name: string;
  description: string | null;
  environmentType: EnvironmentType;
  baseUrl: string;
  active: boolean;
  timeoutMs: number;
  maxRetries: number;
  grantType: string;
  passwordIsPreHashed: boolean;
  tokenRefreshMarginSeconds: number;
  getValidationStepHttpMethod: ConfigurableHttpMethod;
  launchUrlTemplate: string | null;
  createValidationEndpoint: string;
  saveValidationStepEndpoint: string;
  getValidationStepEndpoint: string;
  getValidationDataEndpoint: string;
  authTokenEndpoint: string;
  webhookUrl: string | null;
  webhookActive: boolean;
  basicAuthUsernameConfigured: boolean;
  basicAuthPasswordConfigured: boolean;
  apiUsernameConfigured: boolean;
  apiPasswordConfigured: boolean;
  webhookUsernameConfigured: boolean;
  webhookPasswordConfigured: boolean;
  connectionStatus: "NOT_CONFIGURED" | "UNKNOWN" | "OK" | "FAILED";
  lastTestedAt: string | null;
  integrationModel: IntegrationModel;
  /** `null` = ambiente de plataforma (histórico, no pertenece a ningún cliente). */
  clientId: string | null;
  /** Clave de API para sistemas externos (ver `ExternalApiKeyStatusDto`) — solo aplica a
   * ambientes con `integrationModel: "WEB_SDK"`. */
  externalApiKey: ExternalApiKeyStatusDto;
  createdAt: string;
  updatedAt: string;
}

/**
 * Estado (nunca el valor) de la clave de API que un sistema externo usa para crear
 * validaciones Web SDK sin pasar por la consola — ver `websdk-external.routes.ts` y
 * `external-api-key.service.ts`. `prefix` son los primeros caracteres de la clave (no
 * secretos), solo para que el operador identifique cuál está activa.
 */
export interface ExternalApiKeyStatusDto {
  configured: boolean;
  prefix: string | null;
  createdAt: string | null;
  lastUsedAt: string | null;
}

/** La clave real solo viaja en la respuesta de generar/rotar — nunca se puede volver a
 * consultar después (se guarda únicamente su hash). */
export interface ExternalApiKeyGeneratedDto extends ExternalApiKeyStatusDto {
  rawKey: string;
}

/**
 * Representación pública de un WebSdkConfig: NUNCA incluye secretos, solo banderas
 * `*Configured`. Ver docs/security-decisions.md y docs/websdk-integration.md.
 */
export interface WebSdkOnboardingMessagesDto {
  welcomeTitle: string;
  welcomeBody: string;
  documentTitle: string;
  documentBody: string;
  documentRetryBody: string;
  livenessTitle: string;
  livenessBody: string;
  completingTitle: string;
  completingBody: string;
  successTitle: string;
  successBody: string;
  blockedTitle: string;
  blockedBody: string;
  genericErrorBody: string;
}

export interface WebSdkConfigDto {
  environmentId: string;
  sdkBaseUrl: string;
  sdkRequestId: string | null;
  sdkTokenConfigured: boolean;

  documentCaptureEngine: DocumentCaptureEngine;
  acuantPassiveUsernameConfigured: boolean;
  acuantPassivePasswordConfigured: boolean;
  acuantPassiveSubscriptionIdConfigured: boolean;
  acuantAcasEndpoint: string;
  acuantLivenessEndpoint: string;
  acuantAssureidEndpoint: string;
  acuantParams: { idData: boolean; idPhoto: boolean; manualCapture: boolean };
  acuantConfiguration: Record<string, unknown>;

  regulaLicenseConfigured: boolean;
  regulaApiBasePath: string | null;
  regulaCaptureType: RegulaCaptureType;
  regulaParams: { idData: boolean; idPhoto: boolean };
  regulaConfiguration: Record<string, unknown>;

  captureIdParams: { idPhoto: boolean; originalPhoto: boolean };
  captureIdConfiguration: Record<string, unknown>;

  biometricEngine: BiometricEngine;
  facetecUseMiddleware: boolean;
  facetecMiddleware: Record<string, unknown>;
  facetecDeviceKeyIdentifierConfigured: boolean;
  facetecPublicFaceScanEncryptionKeyConfigured: boolean;
  facetecProductionKeyTextConfigured: boolean;
  facetecConfiguration: Record<string, unknown>;

  checkEndpoint: string;
  compareFacesEndpoint: string;
  getValidationKeysEndpoint: string;
  saveValidationDataEndpoint: string;

  checkMaxAttempts: number;
  checkAcceptedRisk: RiskLevel;
  faceMatchMinConfidence: number;

  onboardingMessages: WebSdkOnboardingMessagesDto;

  createdAt: string;
  updatedAt: string;
}

/** Colores/tipografías (`fadCustomization`) — misma forma que ya usan los 4 módulos del Web SDK
 * (Acuant/Regula/CaptureId/Facetec) en `configuration.customization.fadCustomization`. Todos los
 * campos son opcionales: lo que una plantilla no fije, no se toca. */
export interface WebSdkTemplateCustomizationDto {
  colors?: { primary?: string; secondary?: string; tertiary?: string };
  buttons?: {
    primary?: { backgroundColor?: string; labelColor?: string };
    secondary?: { backgroundColor?: string; labelColor?: string };
  };
  fonts?: {
    title?: { fontSize?: string; fontFamily?: string };
    subtitle?: { fontSize?: string; fontFamily?: string };
    content?: { fontSize?: string; fontFamily?: string };
    button?: { fontSize?: string; fontFamily?: string };
  };
}

/**
 * Plantilla reutilizable del modelo Web SDK — equivalente de ValidationTemplate para
 * API_BY_STEPS, pero con su propia forma (ver el comentario en `prisma/schema.prisma`): solo
 * cubre lo que puede variar por proceso sin credenciales (textos, tema, umbrales), nunca el
 * motor de documento ni las credenciales, que siguen siendo del ambiente. Los campos de
 * mensajes/tema/umbrales son parciales — `null`/ausente = "usa lo que ya tenga el ambiente".
 */
export interface WebSdkTemplateDto {
  id: string;
  name: string;
  description: string | null;
  environmentId: string;
  active: boolean;
  onboardingMessages: Partial<WebSdkOnboardingMessagesDto>;
  customization: WebSdkTemplateCustomizationDto;
  checkMaxAttempts: number | null;
  checkAcceptedRisk: RiskLevel | null;
  faceMatchMinConfidence: number | null;
  createdById: string | null;
  updatedById: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderCatalogEntryDto {
  id: string;
  providerKey: string;
  providerLabel: string;
  providerType: string;
  externalProviderId: number;
  enabled: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface TestConnectionResultDto {
  success: boolean;
  message: string;
  code?: string;
  tokenType?: string;
  expiresIn?: number;
}

/** Todo lo que el navegador necesita para arrancar los SDKs de Acuant/Facetec (ver
 * docs/websdk-integration.md). Las credenciales aquí SÍ viajan al navegador porque son
 * inherentes al diseño de esos SDKs de terceros (corren en un iframe client-side); lo que
 * nunca viaja es el client_secret OAuth propio ni la key/vector de cifrado AES del .FAD. */
export interface WebSdkSessionInitDto {
  executionId: string;
  sdkToken: string;
  sdkEnvironment: "UATHA" | "PROD";
  sdkBaseUrl: string;
  sdkRequestId: string | null;
  documentCaptureEngine: DocumentCaptureEngine;
  /** Poblado solo cuando `documentCaptureEngine === "ACUANT"`. */
  acuant?: {
    credentials: {
      passiveUsername: string;
      passivePassword: string;
      passiveSubscriptionId: string;
      acasEndpoint: string;
      livenessEndpoint: string;
      assureidEndpoint: string;
    };
    params: { idData: boolean; idPhoto: boolean; manualCapture: boolean };
    configuration: Record<string, unknown>;
  };
  /** Poblado solo cuando `documentCaptureEngine === "REGULA"` — ver "FAD SDK Web Regula"
   * §Input parameters (`credentials = { license, apiBasePath }`, `captureType`). */
  regula?: {
    credentials: { license: string; apiBasePath: string };
    idData: boolean;
    idPhoto: boolean;
    captureType: RegulaCaptureType;
    configuration: Record<string, unknown>;
  };
  /** Poblado solo cuando `documentCaptureEngine === "CAPTURE_ID"` — ver "FAD SDK Web CaptureId"
   * §Parameters. No lleva `credentials`: `startCaptureId(configuration)` se autentica con el
   * `sdkToken` ya presente en este DTO. `configuration.output.{idPhoto,originalPhoto}` se
   * completa a partir de `captureIdParams` (mismo patrón que fad-demo-v2 FadSdkService). */
  captureId?: {
    configuration: Record<string, unknown>;
  };
  biometricEngine: BiometricEngine;
  facetec: {
    useMiddleware: boolean;
    middleware: Record<string, unknown> | null;
    credentials: {
      deviceKeyIdentifier: string;
      publicFaceScanEncryptionKey: string;
      productionKeyText: { domains: string; expiryDate: string; key: string };
    } | null;
    configuration: Record<string, unknown>;
  };
  checkMaxAttempts: number;
}

export interface WebSdkCheckResultDto {
  accepted: boolean;
  risk: string;
  key: string;
  attemptsUsed: number;
  attemptsMax: number;
  /** true cuando se agotaron los intentos: el flujo debe detenerse (no permite más recapturas). */
  exhausted: boolean;
}

/** Enlace de captura Web SDK compartible por QR/correo/WhatsApp (ver websdk-share). El `token`
 * y `publicUrl` solo se devuelven en la respuesta de creación — nunca se vuelven a exponer
 * completos después (evita que un listado filtre el bearer del enlace). */
export interface WebSdkShareLinkDto {
  id: string;
  token: string | null;
  publicUrl: string | null;
  environmentId: string;
  environmentName: string;
  processName: string | null;
  clientNameMasked: string;
  status: "PENDING" | "STARTED" | "COMPLETED" | "EXPIRED";
  executionId: string | null;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
}

/** Estado de una validación creada por un sistema externo (ver `websdk-external.routes.ts`) —
 * lo que ese sistema consulta mientras su usuario completa (o no) la captura en el enlace que
 * recibió. `normalizedStatus`/`result` solo vienen poblados una vez que el enlace generó una
 * ejecución (`executionId` no nulo); antes de eso son `null`, nunca se fabrica un valor. `detail`
 * es el resultado COMPLETO (OCR, validación de documento, alertas, clasificación, comparación
 * facial — la misma forma canónica que ve un operador en el reporte de la consola): `null` hasta
 * que el enlace queda `COMPLETED`, momento en el que se puebla de una sola vez con
 * `NormalizedValidationDetail` tal cual quedó normalizado — nunca un subconjunto ni un resumen
 * fabricado. */
export interface ExternalWebSdkValidationStatusDto {
  id: string;
  status: "PENDING" | "STARTED" | "COMPLETED" | "EXPIRED";
  executionId: string | null;
  normalizedStatus: string | null;
  result: string | null;
  detail: NormalizedValidationDetail | null;
  expiresAt: string;
  createdAt: string;
}

/** Info pública mínima que ve el cliente al abrir `/v/:token` — sin PII más allá de su propio
 * nombre (que él mismo o el operador ya conocían) y sin nada de configuración interna. */
export interface WebSdkPublicShareInfoDto {
  status: "PENDING" | "STARTED" | "COMPLETED" | "EXPIRED";
  environmentName: string;
  processName: string | null;
  clientName: string;
  onboardingMessages: WebSdkOnboardingMessagesDto;
}

export interface MessagingConfigDto {
  smtpHost: string | null;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUserConfigured: boolean;
  smtpPasswordConfigured: boolean;
  fromAddress: string | null;
  fromName: string;

  whatsappApiBaseUrl: string;
  whatsappPhoneNumberId: string | null;
  whatsappAccessTokenConfigured: boolean;
  whatsappTemplateName: string | null;
  whatsappTemplateLanguage: string;

  updatedAt: string;
}

export interface ValidationExecutionListItemDto {
  id: string;
  validationId: string | null;
  processName: string;
  environmentName: string;
  templateName: string | null;
  clientNameMasked: string;
  clientEmailMasked: string;
  normalizedStatus: string;
  rawStatus: string | null;
  result: string | null;
  isDemo: boolean;
  startedAt: string | null;
  completedAt: string | null;
  lastSyncedAt: string | null;
  createdAt: string;
  createdByName: string | null;
}

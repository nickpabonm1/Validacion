import type { EnvironmentType, UserRole, ConfigurableHttpMethod, IntegrationModel, DocumentCaptureEngine, BiometricEngine, RiskLevel } from "./enums";

export interface AuthenticatedUserDto {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  active: boolean;
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
  createdAt: string;
  updatedAt: string;
}

/**
 * Representación pública de un WebSdkConfig: NUNCA incluye secretos, solo banderas
 * `*Configured`. Ver docs/security-decisions.md y docs/websdk-integration.md.
 */
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
  acuant: {
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

import type { EnvironmentType, UserRole, ConfigurableHttpMethod } from "./enums";

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

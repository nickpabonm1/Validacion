import type { ApiEnvironmentDto, ConfigurableHttpMethod, EnvironmentType, IntegrationModel } from "@fad-console/shared-types";
import type { ApiEnvironmentInput } from "@fad-console/validation-schemas";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/errors";
import { credentialEncryptionService } from "../credentials/credential-encryption.service";
import { assertWithinScope, clientWhereClause, type ClientScope } from "../clients/client-scope";
import { toExternalApiKeyStatusDto } from "./external-api-key.service";

type EnvironmentRecord = Awaited<ReturnType<typeof prisma.apiEnvironment.findFirstOrThrow>>;

export function toEnvironmentDto(env: EnvironmentRecord): ApiEnvironmentDto {
  return {
    id: env.id,
    name: env.name,
    description: env.description,
    environmentType: env.environmentType as EnvironmentType,
    baseUrl: env.baseUrl,
    active: env.active,
    timeoutMs: env.timeoutMs,
    maxRetries: env.maxRetries,
    grantType: env.grantType,
    passwordIsPreHashed: env.passwordIsPreHashed,
    tokenRefreshMarginSeconds: env.tokenRefreshMarginSeconds,
    getValidationStepHttpMethod: env.getValidationStepHttpMethod as ConfigurableHttpMethod,
    launchUrlTemplate: env.launchUrlTemplate,
    createValidationEndpoint: env.createValidationEndpoint,
    saveValidationStepEndpoint: env.saveValidationStepEndpoint,
    getValidationStepEndpoint: env.getValidationStepEndpoint,
    getValidationDataEndpoint: env.getValidationDataEndpoint,
    authTokenEndpoint: env.authTokenEndpoint,
    webhookUrl: env.webhookUrl,
    webhookActive: env.webhookActive,
    basicAuthUsernameConfigured: credentialEncryptionService.isConfigured(env.basicAuthUsernameEnc),
    basicAuthPasswordConfigured: credentialEncryptionService.isConfigured(env.basicAuthPasswordEnc),
    apiUsernameConfigured: credentialEncryptionService.isConfigured(env.apiUsernameEnc),
    apiPasswordConfigured: credentialEncryptionService.isConfigured(env.apiPasswordEnc),
    webhookUsernameConfigured: credentialEncryptionService.isConfigured(env.webhookUsernameEnc),
    webhookPasswordConfigured: credentialEncryptionService.isConfigured(env.webhookPasswordEnc),
    connectionStatus: env.connectionStatus as ApiEnvironmentDto["connectionStatus"],
    lastTestedAt: env.lastTestedAt ? env.lastTestedAt.toISOString() : null,
    integrationModel: env.integrationModel as IntegrationModel,
    clientId: env.clientId,
    externalApiKey: toExternalApiKeyStatusDto(env),
    createdAt: env.createdAt.toISOString(),
    updatedAt: env.updatedAt.toISOString(),
  };
}

/** true cuando el ambiente tiene lo mínimo (usuario/clave de API) para intentar autenticar
 * contra FAD. Se usa para decidir si el botón de ejecución real está habilitado. */
export function hasMinimumCredentials(env: { apiUsernameEnc: string | null; apiPasswordEnc: string | null }): boolean {
  return (
    credentialEncryptionService.isConfigured(env.apiUsernameEnc) &&
    credentialEncryptionService.isConfigured(env.apiPasswordEnc)
  );
}

export async function listEnvironments(scope?: ClientScope) {
  const where = scope ? clientWhereClause(scope) : undefined;
  return prisma.apiEnvironment.findMany({ where: where ? { clientId: where } : {}, orderBy: { createdAt: "asc" } });
}

export async function getEnvironmentOrThrow(id: string, scope?: ClientScope) {
  const environment = await prisma.apiEnvironment.findUnique({ where: { id } });
  if (!environment) throw AppError.notFound("Ambiente no encontrado");
  if (scope) assertWithinScope(environment.clientId, scope);
  return environment;
}

function buildCredentialFields(input: ApiEnvironmentInput) {
  return {
    basicAuthUsernameEnc: credentialEncryptionService.encryptIfPresent(input.basicAuthUsername),
    basicAuthPasswordEnc: credentialEncryptionService.encryptIfPresent(input.basicAuthPassword),
    apiUsernameEnc: credentialEncryptionService.encryptIfPresent(input.apiUsername),
    apiPasswordEnc: credentialEncryptionService.encryptIfPresent(input.apiPassword),
    webhookUsernameEnc: credentialEncryptionService.encryptIfPresent(input.webhookUsername),
    webhookPasswordEnc: credentialEncryptionService.encryptIfPresent(input.webhookPassword),
  };
}

export async function createEnvironment(input: ApiEnvironmentInput, scope?: ClientScope) {
  let clientId = input.clientId ?? null;
  if (scope) {
    // Un ADMIN de cliente solo puede crear ambientes dentro de su propio subárbol; sin cliente
    // explícito, se asume su propio cliente.
    if (scope.allowedIds !== null) {
      if (!clientId) clientId = scope.clientId;
      assertWithinScope(clientId, scope);
    }
  }
  const credentials = buildCredentialFields(input);
  return prisma.apiEnvironment.create({
    data: {
      name: input.name,
      clientId,
      description: input.description ?? null,
      environmentType: input.environmentType,
      baseUrl: input.baseUrl,
      active: input.active,
      timeoutMs: input.timeoutMs,
      maxRetries: input.maxRetries,
      grantType: input.grantType,
      passwordIsPreHashed: input.passwordIsPreHashed,
      tokenRefreshMarginSeconds: input.tokenRefreshMarginSeconds,
      authTokenEndpoint: input.authTokenEndpoint,
      createValidationEndpoint: input.createValidationEndpoint,
      saveValidationStepEndpoint: input.saveValidationStepEndpoint,
      getValidationStepEndpoint: input.getValidationStepEndpoint,
      getValidationStepHttpMethod: input.getValidationStepHttpMethod,
      getValidationDataEndpoint: input.getValidationDataEndpoint,
      launchUrlTemplate: input.launchUrlTemplate ?? null,
      webhookUrl: input.webhookUrl ?? null,
      webhookActive: input.webhookActive,
      connectionStatus: "NOT_CONFIGURED",
      integrationModel: input.integrationModel,
      ...credentials,
    },
  });
}

export async function updateEnvironment(id: string, input: ApiEnvironmentInput, scope?: ClientScope) {
  await getEnvironmentOrThrow(id, scope);
  const credentials = buildCredentialFields(input);
  return prisma.apiEnvironment.update({
    where: { id },
    data: {
      name: input.name,
      description: input.description ?? null,
      environmentType: input.environmentType,
      baseUrl: input.baseUrl,
      active: input.active,
      timeoutMs: input.timeoutMs,
      maxRetries: input.maxRetries,
      grantType: input.grantType,
      passwordIsPreHashed: input.passwordIsPreHashed,
      tokenRefreshMarginSeconds: input.tokenRefreshMarginSeconds,
      authTokenEndpoint: input.authTokenEndpoint,
      createValidationEndpoint: input.createValidationEndpoint,
      saveValidationStepEndpoint: input.saveValidationStepEndpoint,
      getValidationStepEndpoint: input.getValidationStepEndpoint,
      getValidationStepHttpMethod: input.getValidationStepHttpMethod,
      getValidationDataEndpoint: input.getValidationDataEndpoint,
      launchUrlTemplate: input.launchUrlTemplate ?? null,
      webhookUrl: input.webhookUrl ?? null,
      webhookActive: input.webhookActive,
      integrationModel: input.integrationModel,
      ...credentials,
    },
  });
}

export async function deleteEnvironment(id: string, scope?: ClientScope) {
  await getEnvironmentOrThrow(id, scope);
  await prisma.apiEnvironment.delete({ where: { id } });
}

const CREDENTIAL_FIELD_MAP = {
  basicAuthUsername: "basicAuthUsernameEnc",
  basicAuthPassword: "basicAuthPasswordEnc",
  apiUsername: "apiUsernameEnc",
  apiPassword: "apiPasswordEnc",
  webhookUsername: "webhookUsernameEnc",
  webhookPassword: "webhookPasswordEnc",
} as const;

export type CredentialFieldKey = keyof typeof CREDENTIAL_FIELD_MAP;

export async function clearCredentialField(id: string, field: CredentialFieldKey, scope?: ClientScope) {
  await getEnvironmentOrThrow(id, scope);
  const column = CREDENTIAL_FIELD_MAP[field];
  return prisma.apiEnvironment.update({ where: { id }, data: { [column]: null } });
}

export async function setConnectionStatus(id: string, status: "OK" | "FAILED") {
  return prisma.apiEnvironment.update({
    where: { id },
    data: { connectionStatus: status, lastTestedAt: new Date() },
  });
}

import { randomBytes } from "node:crypto";
import type { ExternalApiKeyGeneratedDto, ExternalApiKeyStatusDto } from "@fad-console/shared-types";
import { prisma } from "../../lib/prisma";
import { sha256Hex } from "../../lib/hash";
import { AppError } from "../../lib/errors";

type EnvironmentRecord = Awaited<ReturnType<typeof prisma.apiEnvironment.findFirstOrThrow>>;

const KEY_PREFIX = "wsk_live_";
/** Cuántos caracteres del inicio de la clave se guardan sin cifrar para que el operador pueda
 * identificar cuál está activa en la interfaz — nunca es suficiente para reconstruir la clave. */
const VISIBLE_PREFIX_LENGTH = KEY_PREFIX.length + 8;

export function toExternalApiKeyStatusDto(env: EnvironmentRecord): ExternalApiKeyStatusDto {
  return {
    configured: Boolean(env.externalApiKeyHash),
    prefix: env.externalApiKeyPrefix,
    createdAt: env.externalApiKeyCreatedAt ? env.externalApiKeyCreatedAt.toISOString() : null,
    lastUsedAt: env.externalApiKeyLastUsedAt ? env.externalApiKeyLastUsedAt.toISOString() : null,
  };
}

/**
 * Genera (o rota) la clave de API de este ambiente para que un sistema externo pueda crear
 * validaciones Web SDK por su cuenta (ver `websdk-external.routes.ts`). Igual patrón que
 * `password-reset.service.ts`: solo se guarda el hash SHA-256, la clave real solo viaja en ESTA
 * respuesta — si se pierde, hay que rotarla, nunca se puede recuperar. Recibe el ambiente ya
 * resuelto (`getEnvironmentOrThrow`, con su verificación de alcance por cliente ya aplicada en la
 * ruta) para no depender de `environments.service.ts` y evitar un ciclo de importación.
 */
export async function generateExternalApiKey(environment: EnvironmentRecord): Promise<ExternalApiKeyGeneratedDto> {
  if (environment.integrationModel !== "WEB_SDK") {
    throw AppError.badRequest("Solo los ambientes con modelo de integración Web SDK admiten una clave de API externa.");
  }

  const rawKey = `${KEY_PREFIX}${randomBytes(32).toString("base64url")}`;
  const externalApiKeyHash = sha256Hex(rawKey);
  const externalApiKeyPrefix = `${rawKey.slice(0, VISIBLE_PREFIX_LENGTH)}…`;
  const now = new Date();

  const updated = await prisma.apiEnvironment.update({
    where: { id: environment.id },
    data: {
      externalApiKeyHash,
      externalApiKeyPrefix,
      externalApiKeyCreatedAt: now,
      externalApiKeyLastUsedAt: null,
    },
  });

  return { ...toExternalApiKeyStatusDto(updated), rawKey };
}

export async function revokeExternalApiKey(environmentId: string): Promise<EnvironmentRecord> {
  return prisma.apiEnvironment.update({
    where: { id: environmentId },
    data: {
      externalApiKeyHash: null,
      externalApiKeyPrefix: null,
      externalApiKeyCreatedAt: null,
      externalApiKeyLastUsedAt: null,
    },
  });
}

/**
 * Resuelve una clave de API cruda (header `Authorization: Bearer <clave>` de un sistema externo)
 * al ambiente Web SDK al que pertenece. Nunca revela si la clave existe o no en el mensaje de
 * error (mismo criterio que `resetPasswordWithToken`) — un mensaje genérico no ayuda a un
 * atacante a distinguir entre "clave inexistente" y "ambiente inactivo".
 */
export async function resolveEnvironmentByExternalApiKey(rawKey: string): Promise<EnvironmentRecord> {
  const hash = sha256Hex(rawKey);
  const environment = await prisma.apiEnvironment.findUnique({ where: { externalApiKeyHash: hash } });
  if (!environment || !environment.active || environment.integrationModel !== "WEB_SDK") {
    throw AppError.unauthorized("Clave de API inválida o inactiva.");
  }
  await prisma.apiEnvironment.update({
    where: { id: environment.id },
    data: { externalApiKeyLastUsedAt: new Date() },
  });
  return environment;
}

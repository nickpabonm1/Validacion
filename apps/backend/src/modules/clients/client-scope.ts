import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/errors";

/**
 * Alcance de datos del usuario autenticado dentro de la jerarquía de clientes (ver `Client` en
 * prisma/schema.prisma). Un usuario de plataforma (`clientId: null`) tiene `allowedIds: null`
 * (sin restricción — ve y administra todo, igual que antes de que existiera esta jerarquía). Un
 * usuario de un cliente solo ve su propio cliente y su subárbol completo de hijos.
 */
export interface ClientScope {
  clientId: string | null;
  allowedIds: string[] | null;
}

/** BFS por todo el subárbol de un cliente, incluyéndolo a él mismo (primer elemento). */
export async function getClientSubtreeIds(rootClientId: string): Promise<string[]> {
  const ids = [rootClientId];
  let frontier = [rootClientId];
  while (frontier.length > 0) {
    const children = await prisma.client.findMany({
      where: { parentClientId: { in: frontier } },
      select: { id: true },
    });
    frontier = children.map((c) => c.id);
    ids.push(...frontier);
  }
  return ids;
}

export async function buildClientScope(user: { clientId: string | null }): Promise<ClientScope> {
  if (!user.clientId) return { clientId: null, allowedIds: null };
  return { clientId: user.clientId, allowedIds: await getClientSubtreeIds(user.clientId) };
}

/** Lanza 403 si `targetClientId` no está dentro del alcance. `allowedIds: null` (plataforma)
 * nunca restringe. `targetClientId: null` (recurso de plataforma) solo es válido para un usuario
 * de plataforma. */
export function assertWithinScope(targetClientId: string | null, scope: ClientScope): void {
  if (scope.allowedIds === null) return;
  if (!targetClientId || !scope.allowedIds.includes(targetClientId)) {
    throw AppError.forbidden("No tienes acceso a este cliente");
  }
}

/** Filtro Prisma `where` para un modelo con columna `clientId` directa (User, ApiEnvironment,
 * Client.id). `null` = sin filtro (plataforma). */
export function clientWhereClause(scope: ClientScope): { in: string[] } | undefined {
  return scope.allowedIds === null ? undefined : { in: scope.allowedIds };
}

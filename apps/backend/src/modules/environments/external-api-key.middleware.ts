import type { NextFunction, Request, Response } from "express";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/errors";
import { resolveEnvironmentByExternalApiKey } from "./external-api-key.service";

type EnvironmentRecord = Awaited<ReturnType<typeof prisma.apiEnvironment.findFirstOrThrow>>;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Ambiente resuelto a partir de la clave de API externa (ver
       * `requireExternalApiKey`) — nunca se acepta un `environmentId` del cuerpo/params de una
       * petición autenticada así: siempre se deriva de la clave. */
      externalApiEnvironment?: EnvironmentRecord;
    }
  }
}

function extractRawKey(req: Request): string | null {
  const header = req.get("authorization");
  if (header?.startsWith("Bearer ")) return header.slice("Bearer ".length).trim();
  const apiKeyHeader = req.get("x-api-key");
  if (typeof apiKeyHeader === "string" && apiKeyHeader.length > 0) return apiKeyHeader;
  return null;
}

/** Autentica una petición de un sistema externo con la clave de API de un ambiente Web SDK
 * (`Authorization: Bearer <clave>` o `X-Api-Key: <clave>`) — nunca una cookie de sesión. Ver
 * `external-api-key.service.ts` para cómo se genera/verifica la clave. */
export async function requireExternalApiKey(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const rawKey = extractRawKey(req);
    if (!rawKey) {
      throw AppError.unauthorized("Falta la clave de API (encabezado Authorization: Bearer <clave>).");
    }
    req.externalApiEnvironment = await resolveEnvironmentByExternalApiKey(rawKey);
    next();
  } catch (error) {
    next(error);
  }
}

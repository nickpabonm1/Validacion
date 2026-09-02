import { Router } from "express";
import { fromJsonField } from "../../lib/json-field";
import { AppError } from "../../lib/errors";
import { logger } from "../../lib/logger";
import { requireAuth } from "../auth/auth.middleware";
import { getExecutionOrThrow } from "../executions/executions.service";
import { fadApiAdapter } from "../fad-adapter/fad-api-adapter";
import type { NormalizedValidationDetail } from "@fad-console/shared-types";

export const mediaProxyRouter = Router();

mediaProxyRouter.use(requireAuth);

/**
 * Proxy autenticado de archivos: nunca acepta una URL arbitraria del cliente. El índice del
 * archivo se resuelve contra la lista de archivos ya almacenada server-side para la ejecución
 * (protección SSRF, ver docs/security-decisions.md), y se valida que el host coincida con el
 * `baseUrl` del ambiente antes de solicitarlo.
 */
mediaProxyRouter.get("/:executionId/:fileIndex", async (req, res, next) => {
  try {
    const execution = await getExecutionOrThrow(req.params.executionId as string);
    const detail = fromJsonField<NormalizedValidationDetail | null>(execution.normalizedResponse, null);
    const index = Number(req.params.fileIndex);
    const file = detail?.files?.[index];
    if (!file || !file.fileUrl) {
      throw AppError.notFound("Archivo no encontrado");
    }

    let target: URL;
    try {
      target = new URL(file.fileUrl);
    } catch {
      throw AppError.badRequest("URL de archivo inválida");
    }

    const environmentHost = new URL(execution.environment.baseUrl).host;
    if (target.host !== environmentHost) {
      logger.warn("Media proxy bloqueó una URL fuera del host del ambiente", {
        targetHost: target.host,
        environmentHost,
      });
      throw AppError.forbidden("El archivo solicitado no pertenece al ambiente configurado");
    }

    // `getValidationMedia`/`getValidationThumbnail` exigen el mismo Bearer OAuth que el resto de
    // la API FAD (confirmado con una respuesta real: sin este header, FAD responde 401/403, que
    // este proxy antes trataba como "archivo no encontrado" — nunca se había estado autenticando
    // esta petición). Las ejecuciones demo usan URLs ficticias que de todas formas nunca pasan la
    // validación de host de arriba, así que un fallo al obtener el token ahí no debería llegar
    // aquí; por robustez, si de todos modos ocurre, se sigue sin el header en vez de romper el
    // proxy — el propio `fetch` sin auth ya refleja el error real (401/403) del upstream.
    let authHeaders: Record<string, string> = {};
    if (!execution.isDemo) {
      try {
        const accessToken = await fadApiAdapter.getAccessToken(execution.environment);
        authHeaders = { Authorization: `Bearer ${accessToken}` };
      } catch (error) {
        logger.warn("No fue posible obtener un access_token para el media proxy; se solicita sin autenticación", {
          executionId: execution.id,
          error: (error as Error).message,
        });
      }
    }

    const upstream = await fetch(target.toString(), { headers: authHeaders });
    if (!upstream.ok || !upstream.body) {
      throw AppError.upstream("No fue posible obtener el archivo solicitado", { status: upstream.status });
    }

    res.setHeader("Content-Type", upstream.headers.get("content-type") ?? "application/octet-stream");
    res.setHeader("Cache-Control", "private, max-age=60");
    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.send(buffer);
  } catch (error) {
    next(error);
  }
});

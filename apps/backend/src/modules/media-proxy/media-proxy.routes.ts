import { Router } from "express";
import { fromJsonField } from "../../lib/json-field";
import { AppError } from "../../lib/errors";
import { logger } from "../../lib/logger";
import { requireAuth } from "../auth/auth.middleware";
import { getExecutionOrThrow } from "../executions/executions.service";
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

    const upstream = await fetch(target.toString());
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

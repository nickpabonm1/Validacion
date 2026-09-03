import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { logger } from "./logger";

export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message: string, details?: unknown): AppError {
    return new AppError(400, "BAD_REQUEST", message, details);
  }
  static unauthorized(message = "No autenticado"): AppError {
    return new AppError(401, "UNAUTHORIZED", message);
  }
  static forbidden(message = "No autorizado para esta acción"): AppError {
    return new AppError(403, "FORBIDDEN", message);
  }
  static notFound(message = "Recurso no encontrado"): AppError {
    return new AppError(404, "NOT_FOUND", message);
  }
  static conflict(message: string): AppError {
    return new AppError(409, "CONFLICT", message);
  }
  static upstream(message: string, details?: unknown): AppError {
    return new AppError(502, "UPSTREAM_ERROR", message, details);
  }
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ error: { code: "NOT_FOUND", message: "Ruta no encontrada" } });
}

/** Detecta un `ZodError` de forma estructural, no solo con `instanceof`: los esquemas de
 * `@fad-console/validation-schemas` (un paquete del monorepo) y los definidos aquí mismo pueden
 * terminar resolviendo a instancias de la clase `ZodError` de dos copias distintas del paquete
 * `zod` en tiempo de ejecución (confirmado en pruebas: Vitest empaqueta las dependencias del
 * workspace por separado de las del paquete raíz, y `instanceof` falla entre esas dos copias aun
 * siendo la misma versión) — sin este chequeo estructural, CUALQUIER error de validación de body
 * en toda la app se reportaba como 500 en vez de 400. */
function isZodError(err: unknown): err is ZodError {
  return (
    err instanceof ZodError ||
    (typeof err === "object" && err !== null && (err as { name?: unknown }).name === "ZodError" && Array.isArray((err as { issues?: unknown }).issues))
  );
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (isZodError(err)) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Los datos enviados no son válidos",
        issues: err.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
      },
    });
    return;
  }

  if (err instanceof AppError) {
    if (err.status >= 500) {
      logger.error(err.message, { code: err.code, path: req.path, details: err.details });
    }
    res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    return;
  }

  logger.error("Error no controlado", { path: req.path, error: err instanceof Error ? err.message : err });
  res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Ocurrió un error interno" } });
}

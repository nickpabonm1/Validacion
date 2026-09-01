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

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ZodError) {
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

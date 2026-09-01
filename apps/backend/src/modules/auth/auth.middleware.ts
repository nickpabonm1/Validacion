import type { NextFunction, Request, Response } from "express";
import type { UserRole } from "@fad-console/shared-types";
import { AppError } from "../../lib/errors";
import { SESSION_COOKIE_NAME, verifySessionToken, type SessionTokenPayload } from "./jwt";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SessionTokenPayload;
    }
  }
}

export function attachUser(req: Request, _res: Response, next: NextFunction): void {
  const token = req.cookies?.[SESSION_COOKIE_NAME];
  if (typeof token === "string") {
    const payload = verifySessionToken(token);
    if (payload) {
      req.user = payload;
    }
  }
  next();
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    next(AppError.unauthorized());
    return;
  }
  next();
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(AppError.unauthorized());
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(AppError.forbidden(`Esta acción requiere el rol: ${roles.join(" o ")}`));
      return;
    }
    next();
  };
}

export function auditContextFrom(req: Request): { userId?: string | null; ip?: string | null; userAgent?: string | null } {
  return {
    userId: req.user?.sub ?? null,
    ip: req.ip ?? null,
    userAgent: req.get("user-agent") ?? null,
  };
}

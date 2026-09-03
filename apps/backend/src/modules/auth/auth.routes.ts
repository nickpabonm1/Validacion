import { Router } from "express";
import rateLimit from "express-rate-limit";
import { BootstrapAdminInputSchema, LoginInputSchema } from "@fad-console/validation-schemas";
import { env } from "../../config/env";
import { AppError } from "../../lib/errors";
import { logAudit } from "../audit/audit.service";
import { countUsers, createUser, findUserByEmail, toUserDto } from "../users/users.service";
import { verifyPassword } from "./password";
import { SESSION_COOKIE_NAME, signSessionToken } from "./jwt";
import { attachUser, auditContextFrom, requireAuth } from "./auth.middleware";

export const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "Demasiados intentos, intente más tarde" } },
});

function setSessionCookie(res: import("express").Response, token: string): void {
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.cookieSecure,
    maxAge: 12 * 60 * 60 * 1000,
    path: "/",
  });
}

/** Asistente de instalación: indica si ya existe al menos un usuario (paso 1 completado). */
authRouter.get("/bootstrap/status", async (_req, res, next) => {
  try {
    const total = await countUsers();
    res.json({ needsBootstrap: total === 0 });
  } catch (error) {
    next(error);
  }
});

/** Crea el primer usuario ADMIN. Solo funciona si todavía no existe ningún usuario. */
authRouter.post("/bootstrap/admin", async (req, res, next) => {
  try {
    const total = await countUsers();
    if (total > 0) {
      throw AppError.conflict("Ya existe al menos un usuario; el asistente de instalación ya fue completado");
    }
    const input = BootstrapAdminInputSchema.parse(req.body);
    const user = await createUser({ ...input, role: "ADMIN", active: true });
    const token = signSessionToken({ sub: user.id, email: user.email, role: "ADMIN", name: user.name, clientId: null });
    setSessionCookie(res, token);
    await logAudit("CREATE", "User", user.id, { userId: user.id }, { note: "Bootstrap admin" });
    res.status(201).json({ user: toUserDto(user) });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/login", loginLimiter, async (req, res, next) => {
  try {
    const input = LoginInputSchema.parse(req.body);
    const user = await findUserByEmail(input.email);
    const auditCtx = { ip: req.ip ?? null, userAgent: req.get("user-agent") ?? null };

    if (!user || !user.active) {
      await logAudit("LOGIN_FAILED", "User", null, auditCtx, { email: input.email });
      throw AppError.unauthorized("Correo o contraseña incorrectos");
    }
    const valid = await verifyPassword(input.password, user.passwordHash);
    if (!valid) {
      await logAudit("LOGIN_FAILED", "User", user.id, auditCtx, {});
      throw AppError.unauthorized("Correo o contraseña incorrectos");
    }

    const token = signSessionToken({
      sub: user.id,
      email: user.email,
      role: user.role as "ADMIN" | "OPERATOR" | "AUDITOR",
      name: user.name,
      clientId: user.clientId,
    });
    setSessionCookie(res, token);
    await logAudit("LOGIN", "User", user.id, { ...auditCtx, userId: user.id });
    res.json({ user: toUserDto(user) });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/logout", attachUser, async (req, res, next) => {
  try {
    res.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
    if (req.user) {
      await logAudit("LOGOUT", "User", req.user.sub, auditContextFrom(req));
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

authRouter.get("/me", attachUser, requireAuth, (req, res) => {
  res.json({
    user: {
      id: req.user!.sub,
      email: req.user!.email,
      role: req.user!.role,
      name: req.user!.name,
      clientId: req.user!.clientId,
    },
  });
});

import { Router } from "express";
import rateLimit from "express-rate-limit";
import { BootstrapAdminInputSchema, ForgotPasswordInputSchema, LoginInputSchema, ResetPasswordInputSchema } from "@fad-console/validation-schemas";
import { env } from "../../config/env";
import { AppError } from "../../lib/errors";
import { logger } from "../../lib/logger";
import { logAudit } from "../audit/audit.service";
import { countUsers, createUser, findUserByEmail, toUserDto } from "../users/users.service";
import { verifyPassword } from "./password";
import { requestPasswordReset, resetPasswordWithToken } from "./password-reset.service";
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

/** Mismo límite que login: ambos endpoints son públicos y podrían usarse para enumerar correos o
 * agotar el envío de SMTP si no se limitan. */
const passwordResetLimiter = rateLimit({
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

/** Siempre responde igual, exista o no el correo, y también si el envío falla por cualquier
 * motivo (p. ej. SMTP mal configurado) — nunca revela nada al llamador anónimo que permita
 * distinguir un caso de otro (evita enumeración de usuarios). Un fallo real de envío sí se
 * registra en el log del servidor para que un administrador lo note; para diagnóstico honesto
 * con feedback real, un ADMIN autenticado puede usar `POST /users/:id/send-password-reset`, que
 * si propaga el error. */
authRouter.post("/forgot-password", passwordResetLimiter, async (req, res, next) => {
  try {
    const input = ForgotPasswordInputSchema.parse(req.body);
    try {
      await requestPasswordReset(input.email, { ip: req.ip ?? null, userAgent: req.get("user-agent") ?? null });
    } catch (error) {
      logger.error("Fallo al procesar una solicitud de restablecimiento de contraseña", {
        error: error instanceof Error ? error.message : error,
      });
    }
    res.json({ message: "Si el correo existe, te enviamos un enlace para restablecer tu contraseña." });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/reset-password", passwordResetLimiter, async (req, res, next) => {
  try {
    const input = ResetPasswordInputSchema.parse(req.body);
    await resetPasswordWithToken(input.token, input.password, { ip: req.ip ?? null, userAgent: req.get("user-agent") ?? null });
    res.status(204).send();
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

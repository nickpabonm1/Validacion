import { Router } from "express";
import { CreateUserInputSchema, UpdateUserInputSchema } from "@fad-console/validation-schemas";
import { requireAuth, requireRole, auditContextFrom } from "../auth/auth.middleware";
import { logAudit } from "../audit/audit.service";
import { AppError } from "../../lib/errors";
import { buildClientScope } from "../clients/client-scope";
import { requestPasswordReset } from "../auth/password-reset.service";
import { createUser, deleteUser, getUserWithinScope, listUsers, toUserDto, updateUser } from "./users.service";

export const usersRouter = Router();

usersRouter.use(requireAuth);

usersRouter.get("/", requireRole("ADMIN", "AUDITOR"), async (req, res, next) => {
  try {
    const scope = await buildClientScope(req.user!);
    const users = await listUsers(scope);
    res.json({ users: users.map(toUserDto) });
  } catch (error) {
    next(error);
  }
});

usersRouter.post("/", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const scope = await buildClientScope(req.user!);
    const input = CreateUserInputSchema.parse(req.body);
    const user = await createUser(input, scope);
    await logAudit("CREATE", "User", user.id, auditContextFrom(req), { role: user.role });
    res.status(201).json({ user: toUserDto(user) });
  } catch (error) {
    next(error);
  }
});

/** Cambiar la contraseña de OTRO usuario aquí (sin pasar por el correo de "Olvidé mi contraseña")
 * es una acción reservada al superadministrador — un ADMIN de plataforma (`clientId === null`),
 * el único con autoridad sobre todo el sistema. Un ADMIN de un cliente (confinado a su propio
 * subárbol) puede administrar el resto de campos de sus usuarios, pero para la contraseña debe
 * usar "Enviar enlace de restablecimiento" como cualquier otro camino — igual que pide la
 * auditoría: cambio directo de contraseña, sin confirmación por correo, solo para el
 * superadministrador. */
usersRouter.patch("/:id", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const scope = await buildClientScope(req.user!);
    const input = UpdateUserInputSchema.parse(req.body);
    if (input.password !== undefined && req.user!.clientId !== null) {
      throw AppError.forbidden(
        "Solo el superadministrador (administrador de plataforma) puede cambiar la contraseña de otro usuario directamente. Usa «Enviar enlace de restablecimiento» en su lugar.",
      );
    }
    const user = await updateUser(req.params.id as string, input, scope);
    const isPasswordReset = input.password !== undefined;
    await logAudit(isPasswordReset ? "ADMIN_PASSWORD_RESET" : "UPDATE", "User", user.id, auditContextFrom(req), {
      fields: Object.keys(input),
      ...(isPasswordReset ? { targetUserEmail: user.email } : {}),
    });
    res.json({ user: toUserDto(user) });
  } catch (error) {
    next(error);
  }
});

/** Alternativa al cambio directo de contraseña (ver PATCH arriba) disponible para CUALQUIER
 * ADMIN, incluido uno confinado a un cliente: dispara el mismo flujo público de "Olvidé mi
 * contraseña" para el correo del usuario objetivo, en vez de fijar la contraseña sin
 * confirmación. */
usersRouter.post("/:id/send-password-reset", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const scope = await buildClientScope(req.user!);
    const user = await getUserWithinScope(req.params.id as string, scope);
    await requestPasswordReset(user.email, auditContextFrom(req));
    res.json({ message: "Si el usuario existe y está activo, se le envió un enlace de restablecimiento." });
  } catch (error) {
    next(error);
  }
});

usersRouter.delete("/:id", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const scope = await buildClientScope(req.user!);
    await deleteUser(req.params.id as string, scope);
    await logAudit("DELETE", "User", req.params.id as string, auditContextFrom(req));
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

import { randomBytes } from "node:crypto";
import { prisma } from "../../lib/prisma";
import { sha256Hex } from "../../lib/hash";
import { AppError } from "../../lib/errors";
import { logAudit, type AuditContext } from "../audit/audit.service";
import { findUserByEmail } from "../users/users.service";
import { hashPassword } from "./password";
import { sendPasswordResetEmail } from "../messaging/email.service";

/** El enlace vive 30 minutos — mismo criterio que los enlaces de captura Web SDK
 * (`SHARE_LINK_TTL_MINUTES`): suficiente para abrir el correo y completar el cambio, corto para
 * minimizar la ventana de un enlace filtrado/interceptado. */
const RESET_TOKEN_TTL_MINUTES = 30;

/**
 * Solicita un restablecimiento de contraseña por correo. Nunca revela si el correo existe o no
 * (misma respuesta genérica siempre) para no permitir enumerar usuarios. Si el correo corresponde
 * a un usuario activo, genera un token de un solo uso, lo guarda cifrado (solo el hash) y envía el
 * enlace por correo — nunca fabrica un envío: si SMTP no está configurado o falla, el error real
 * se propaga (ver `sendPasswordResetEmail`).
 */
export async function requestPasswordReset(email: string, context: AuditContext): Promise<void> {
  const user = await findUserByEmail(email);
  if (!user || !user.active) {
    return;
  }

  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = sha256Hex(rawToken);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);

  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash, expiresAt },
  });

  await sendPasswordResetEmail({ to: user.email, name: user.name, token: rawToken });
  await logAudit("PASSWORD_RESET_REQUESTED", "User", user.id, context);
}

/**
 * Consume un token de restablecimiento y fija la nueva contraseña. Un token inválido, ya usado o
 * expirado siempre da el mismo error genérico (no distingue el motivo, para no ayudar a un
 * atacante a adivinar tokens válidos por fuerza bruta).
 */
export async function resetPasswordWithToken(rawToken: string, newPassword: string, context: AuditContext): Promise<void> {
  const tokenHash = sha256Hex(rawToken);
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

  if (!record || record.usedAt || record.expiresAt.getTime() < Date.now()) {
    throw AppError.badRequest("Este enlace de restablecimiento no es válido o ya expiró. Solicita uno nuevo.");
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ]);

  await logAudit("PASSWORD_RESET_COMPLETED", "User", record.userId, context);
}

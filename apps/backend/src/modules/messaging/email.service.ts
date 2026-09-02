import nodemailer from "nodemailer";
import { AppError } from "../../lib/errors";
import { decryptMessagingCredentials, getMessagingConfig } from "./messaging-config.service";

export interface SendShareLinkEmailInput {
  to: string;
  processName: string;
  environmentName: string;
  publicUrl: string;
}

/** Envía el enlace de captura Web SDK por correo (SMTP, vía `MessagingConfig`). Nunca fabrica
 * una confirmación de envío: si el servidor SMTP no está configurado o rechaza el mensaje, se
 * lanza un `AppError` con el motivo real — nada se reporta como "enviado" sin que nodemailer lo
 * haya confirmado. */
export async function sendShareLinkEmail(input: SendShareLinkEmailInput): Promise<{ messageId: string }> {
  const config = await getMessagingConfig();
  const creds = decryptMessagingCredentials(config);

  if (!config.smtpHost || !config.fromAddress) {
    throw AppError.badRequest(
      "La mensajería por correo no está configurada. Ve a Configuración > Mensajería y completa el servidor SMTP y el remitente.",
    );
  }

  const transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure,
    auth: creds.smtpUser && creds.smtpPassword ? { user: creds.smtpUser, pass: creds.smtpPassword } : undefined,
  });

  const result = await transporter.sendMail({
    from: config.fromName ? `"${config.fromName}" <${config.fromAddress}>` : config.fromAddress,
    to: input.to,
    subject: `${input.processName} — verificación de identidad`,
    text:
      `Te invitamos a completar tu verificación de identidad (${input.processName}, ${input.environmentName}).\n\n` +
      `Abre este enlace desde tu celular para continuar:\n${input.publicUrl}\n\n` +
      `Este enlace expira en poco tiempo y solo puede usarse una vez.`,
    html:
      `<p>Te invitamos a completar tu verificación de identidad (<strong>${escapeHtml(input.processName)}</strong>).</p>` +
      `<p><a href="${escapeHtml(input.publicUrl)}">Toca aquí desde tu celular para continuar</a></p>` +
      `<p style="color:#666;font-size:12px">Este enlace expira en poco tiempo y solo puede usarse una vez.</p>`,
  });

  return { messageId: result.messageId };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

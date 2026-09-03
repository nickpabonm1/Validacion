import nodemailer from "nodemailer";
import { AppError } from "../../lib/errors";
import { env } from "../../config/env";
import { getClientBranding, getClientEmailTemplate } from "../clients/clients.service";
import { decryptMessagingCredentials, getMessagingConfig } from "./messaging-config.service";
import { htmlToPlainText, renderEmailTemplate } from "./email-template";

export interface SendShareLinkEmailInput {
  to: string;
  processName: string;
  environmentName: string;
  publicUrl: string;
  /** Cliente dueño del ambiente que originó el enlace — resuelve qué plantilla (asunto/cuerpo) y
   * qué logo usar (con herencia hacia el ancestro más cercano que los tenga configurados).
   * `null` = usuario/ambiente de plataforma, usa la plantilla por defecto de la consola. */
  clientId: string | null;
}

/** Envía el enlace de captura por correo (SMTP, vía `MessagingConfig`), con la plantilla propia
 * del cliente (o la del ancestro más cercano que tenga una, o la plantilla por defecto de la
 * consola — ver `getClientEmailTemplate`). Nunca fabrica una confirmación de envío: si el
 * servidor SMTP no está configurado o rechaza el mensaje, se lanza un `AppError` con el motivo
 * real — nada se reporta como "enviado" sin que nodemailer lo haya confirmado. */
export async function sendShareLinkEmail(input: SendShareLinkEmailInput): Promise<{ messageId: string }> {
  const config = await getMessagingConfig();
  const creds = decryptMessagingCredentials(config);

  if (!config.smtpHost || !config.fromAddress) {
    throw AppError.badRequest(
      "La mensajería por correo no está configurada. Ve a Configuración > Mensajería y completa el servidor SMTP y el remitente.",
    );
  }

  const [template, branding] = await Promise.all([
    getClientEmailTemplate(input.clientId),
    getClientBranding(input.clientId),
  ]);

  const vars = {
    processName: input.processName,
    environmentName: input.environmentName,
    clientName: branding.clientName ?? input.environmentName,
    link: input.publicUrl,
    logoDataUrl: branding.logoDataUrl,
  };
  const subject = renderEmailTemplate(template.subject, vars);
  const html = renderEmailTemplate(template.bodyHtml, vars);

  const transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure,
    auth: creds.smtpUser && creds.smtpPassword ? { user: creds.smtpUser, pass: creds.smtpPassword } : undefined,
  });

  const result = await transporter.sendMail({
    from: config.fromName ? `"${config.fromName}" <${config.fromAddress}>` : config.fromAddress,
    to: input.to,
    subject,
    text: htmlToPlainText(html),
    html,
  });

  return { messageId: result.messageId };
}

export interface SendPasswordResetEmailInput {
  to: string;
  name: string;
  /** Token en texto plano (nunca el hash) — solo existe en este correo y en el enlace, jamás se
   * persiste sin cifrar (ver `password-reset.service.ts`). */
  token: string;
}

/** Envía el enlace de restablecimiento de contraseña. No usa la plantilla por-cliente (esa es
 * para el enlace de captura de un proceso, con placeholders distintos) — este correo es fijo,
 * igual para todos los clientes. Nunca fabrica un envío: si SMTP no está configurado o falla, el
 * error real se propaga. */
export async function sendPasswordResetEmail(input: SendPasswordResetEmailInput): Promise<{ messageId: string }> {
  const config = await getMessagingConfig();
  const creds = decryptMessagingCredentials(config);

  if (!config.smtpHost || !config.fromAddress) {
    throw AppError.badRequest(
      "La mensajería por correo no está configurada. Ve a Configuración > Mensajería y completa el servidor SMTP y el remitente.",
    );
  }

  const resetUrl = `${env.publicAppUrl.replace(/\/$/, "")}/reset-password/${input.token}`;
  const subject = "Restablecer tu contraseña";
  const html = `
    <p>Hola ${input.name},</p>
    <p>Recibimos una solicitud para restablecer tu contraseña. Este enlace es de un solo uso y expira en 30 minutos:</p>
    <p><a href="${resetUrl}">${resetUrl}</a></p>
    <p>Si tú no solicitaste este cambio, puedes ignorar este correo — tu contraseña no cambiará.</p>
  `;

  const transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpSecure,
    auth: creds.smtpUser && creds.smtpPassword ? { user: creds.smtpUser, pass: creds.smtpPassword } : undefined,
  });

  const result = await transporter.sendMail({
    from: config.fromName ? `"${config.fromName}" <${config.fromAddress}>` : config.fromAddress,
    to: input.to,
    subject,
    text: htmlToPlainText(html),
    html,
  });

  return { messageId: result.messageId };
}

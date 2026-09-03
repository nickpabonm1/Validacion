/**
 * Plantilla del correo que se envía al iniciar un proceso de validación (enlace de captura),
 * configurable por cliente (ver `Client.emailSubjectTemplate`/`emailBodyTemplate` y su herencia
 * en `clients.service.ts`). Placeholders soportados: `{{processName}}`, `{{environmentName}}`,
 * `{{clientName}}`, `{{link}}`, `{{logo}}` (este último inserta el logo del cliente como imagen
 * si tiene uno configurado, o nada si no).
 */
export interface EmailTemplateVars {
  processName: string;
  environmentName: string;
  clientName: string;
  link: string;
  logoDataUrl: string | null;
}

export const DEFAULT_EMAIL_SUBJECT_TEMPLATE = "{{processName}} — verificación de identidad";

export const DEFAULT_EMAIL_BODY_TEMPLATE =
  `<p>Te invitamos a completar tu verificación de identidad (<strong>{{processName}}</strong>).</p>` +
  `<p><a href="{{link}}">Toca aquí desde tu celular para continuar</a></p>` +
  `<p style="color:#666;font-size:12px">Este enlace expira en poco tiempo y solo puede usarse una vez.</p>`;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function renderLogoTag(logoDataUrl: string | null): string {
  if (!logoDataUrl) return "";
  return `<img src="${logoDataUrl}" alt="" style="max-height:48px;max-width:220px;display:block;margin-bottom:16px" />`;
}

/** Sustituye los placeholders `{{campo}}` de una plantilla (asunto o cuerpo HTML) con los datos
 * reales del proceso. La plantilla en sí es HTML de confianza (la escribe el administrador del
 * cliente), pero cada valor sustituido puede venir de datos de la validación y siempre se escapa
 * — nunca se inserta texto de la validación sin escapar en el HTML del correo. `{{logo}}` es la
 * única excepción: inserta el `<img>` que esta misma función genera, no texto ajeno. */
export function renderEmailTemplate(template: string, vars: EmailTemplateVars): string {
  return template
    .replace(/\{\{\s*processName\s*\}\}/g, escapeHtml(vars.processName))
    .replace(/\{\{\s*environmentName\s*\}\}/g, escapeHtml(vars.environmentName))
    .replace(/\{\{\s*clientName\s*\}\}/g, escapeHtml(vars.clientName))
    .replace(/\{\{\s*link\s*\}\}/g, escapeHtml(vars.link))
    .replace(/\{\{\s*logo\s*\}\}/g, renderLogoTag(vars.logoDataUrl));
}

/** Deriva una versión de texto plano a partir del HTML ya renderizado (sin placeholders), para el
 * cuerpo `text` del correo — nunca se le pide al administrador mantener dos plantillas. */
export function htmlToPlainText(html: string): string {
  return html
    .replace(/<a\s+[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, "$2: $1")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

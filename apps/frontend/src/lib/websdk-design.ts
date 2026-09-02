/**
 * Helpers puros (sin React) para editar visualmente el bloque `customization.fadCustomization`
 * que ya usan los 4 módulos del Web SDK (Acuant/Regula/CaptureId/Facetec) dentro de su propio
 * `configuration` — ver `fad-demo-v2/src/environments/environment.ts`, donde los 4 módulos
 * comparten exactamente esta misma forma (`colors`, `buttons.{primary,secondary}`,
 * `fonts.{title,subtitle,content,button}`). El resto de `configuration` (leyendas, vistas,
 * comportamiento) sigue editándose como JSON libre — este editor solo cubre color/tipografía,
 * que es lo que un operador sin conocimientos técnicos necesita ajustar sin escribir JSON.
 */
export interface FadColorPalette {
  primary?: string;
  secondary?: string;
  tertiary?: string;
}

export interface FadButtonStyle {
  backgroundColor?: string;
  labelColor?: string;
}

export interface FadFontStyle {
  fontSize?: string;
  fontFamily?: string;
}

export interface FadCustomization {
  colors?: FadColorPalette;
  buttons?: { primary?: FadButtonStyle; secondary?: FadButtonStyle };
  fonts?: { title?: FadFontStyle; subtitle?: FadFontStyle; content?: FadFontStyle; button?: FadFontStyle };
}

/** Parsea el textarea de configuración JSON de un módulo; nunca lanza — un JSON inválido o vacío
 * se trata como `{}` (el operador sigue viendo el error de sintaxis en el propio textarea). */
export function parseConfigurationJson(text: string): Record<string, unknown> {
  if (!text || !text.trim()) return {};
  try {
    const parsed = JSON.parse(text);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function readFadCustomization(configuration: Record<string, unknown>): FadCustomization {
  const customization = (configuration.customization as Record<string, unknown> | undefined) ?? {};
  return (customization.fadCustomization as FadCustomization | undefined) ?? {};
}

/** Aplica `fadCustomization` sobre el texto de configuración existente, preservando cualquier
 * otro campo que ya tuviera `configuration`/`configuration.customization` (leyendas, vistas,
 * `moduleCustomization`, etc.) — nunca se pierde nada que el operador haya puesto a mano en el
 * JSON avanzado. */
export function writeFadCustomization(configurationText: string, fadCustomization: FadCustomization): string {
  const configuration = parseConfigurationJson(configurationText);
  const customization = (configuration.customization as Record<string, unknown> | undefined) ?? {};
  const next = { ...configuration, customization: { ...customization, fadCustomization } };
  return JSON.stringify(next, null, 2);
}

export const FONT_FAMILY_SUGGESTIONS = [
  "system-ui",
  "Arial, sans-serif",
  "Helvetica, sans-serif",
  "Georgia, serif",
  "Roboto, sans-serif",
  "Segoe UI, sans-serif",
  "Times New Roman, serif",
] as const;

/** `fontSize` viaja como string CSS ("25px") en la configuración real de FAD; el editor visual
 * trabaja con el número en px para un `<input type="number">` simple. */
export function fontSizePx(fontSize: string | undefined): number | undefined {
  if (!fontSize) return undefined;
  const match = /^(\d+(?:\.\d+)?)px$/.exec(fontSize.trim());
  return match ? Number(match[1]) : undefined;
}

export function toFontSizeCss(px: number | undefined): string | undefined {
  return px === undefined || Number.isNaN(px) ? undefined : `${px}px`;
}

/** Un color se considera válido para el picker nativo (`<input type="color">`, que exige
 * `#rrggbb`) si es hex de 6 dígitos; los ejemplos reales a veces traen 8 dígitos (con alpha,
 * p. ej. `#2b2b2b66`) — en ese caso el picker usa un color de respaldo neutro pero el campo de
 * texto conserva el valor original tal cual, sin truncarlo. */
export function isSixDigitHex(value: string | undefined): value is string {
  return !!value && /^#[0-9a-fA-F]{6}$/.test(value);
}

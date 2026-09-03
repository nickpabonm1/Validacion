import type { ClientBrandingDto } from "@fad-console/shared-types";

/** Convierte un color hex (#rrggbb) al triplete HSL "H S% L%" usado por las variables CSS del
 * tema (ver styles/globals.css, `--primary`) — Tailwind las envuelve en `hsl(var(--primary))`. */
export function hexToHslTriplet(hex: string): string | null {
  const match = /^#([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!match) return null;
  const value = match[1]!;
  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

let defaultFaviconHref: string | null = null;

/**
 * Aplica la marca del cliente (color principal + favicon) al documento: sobreescribe `--primary`
 * como variable CSS inline en `<html>` (convive con el tema claro/oscuro, que ya se aplica por
 * clase) y reemplaza el favicon. Sin marca configurada, limpia cualquier override previo para
 * volver a la marca por defecto de la consola — así cambiar de sesión (o cerrar sesión) entre un
 * cliente con marca y uno sin marca nunca deja un color/ícono ajeno pegado.
 */
export function applyClientBranding(branding: Pick<ClientBrandingDto, "primaryColor" | "faviconDataUrl">): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  if (branding.primaryColor) {
    const hsl = hexToHslTriplet(branding.primaryColor);
    if (hsl) root.style.setProperty("--primary", hsl);
  } else {
    root.style.removeProperty("--primary");
  }

  const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!favicon) return;
  if (defaultFaviconHref === null) defaultFaviconHref = favicon.href;
  favicon.href = branding.faviconDataUrl ?? defaultFaviconHref;
}

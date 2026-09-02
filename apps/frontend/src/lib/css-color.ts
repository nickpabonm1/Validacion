/**
 * Convierte cualquier color CSS soportado por el esquema de tema (hex, rgb()/rgba(), hsl()/hsla())
 * a un hex de 6 dígitos, para poder usar siempre el selector nativo `<input type="color">`
 * (que solo entiende `#rrggbb`) sin importar en qué formato venga el valor original — por
 * ejemplo, uno importado desde una colección de Postman o escrito a mano. Devuelve `null` si el
 * valor no es un color reconocible (p. ej. una medida como "15px").
 */
export function toHexColor(value: string): string | null {
  const trimmed = value.trim();

  const hexMatch = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})([0-9a-fA-F]{2})?$/.exec(trimmed);
  const hex = hexMatch?.[1];
  if (hex) {
    if (hex.length === 3) {
      return `#${[...hex].map((c) => c + c).join("")}`.toLowerCase();
    }
    return `#${hex}`.toLowerCase();
  }

  const rgbMatch = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*[\d.]+\s*)?\)$/i.exec(trimmed);
  if (rgbMatch) {
    const [, r, g, b] = rgbMatch;
    return rgbToHex(Number(r), Number(g), Number(b));
  }

  const hslMatch = /^hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*(?:,\s*[\d.]+\s*)?\)$/i.exec(trimmed);
  if (hslMatch) {
    const [, h, s, l] = hslMatch;
    const [r, g, b] = hslToRgb(Number(h), Number(s), Number(l));
    return rgbToHex(r, g, b);
  }

  return null;
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${[clamp(r), clamp(g), clamp(b)].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const sFraction = s / 100;
  const lFraction = l / 100;
  const c = (1 - Math.abs(2 * lFraction - 1)) * sFraction;
  const hPrime = ((h % 360) + 360) % 360 / 60;
  const x = c * (1 - Math.abs((hPrime % 2) - 1));
  let [r, g, b] = [0, 0, 0];
  if (hPrime < 1) [r, g, b] = [c, x, 0];
  else if (hPrime < 2) [r, g, b] = [x, c, 0];
  else if (hPrime < 3) [r, g, b] = [0, c, x];
  else if (hPrime < 4) [r, g, b] = [0, x, c];
  else if (hPrime < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = lFraction - c / 2;
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

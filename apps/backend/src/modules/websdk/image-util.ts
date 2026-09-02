/** Utilidades para manipular imágenes en base64 / data URI recibidas del navegador (resultado de
 * los SDKs de Acuant/Facetec). Puerto de `fad-demo-v1/src/app/utils/image.util.ts`. */

/** Extrae el base64 crudo de un data URI (o lo devuelve tal cual si ya es crudo). */
export function stripDataUri(value: string): string {
  const idx = value.indexOf("base64,");
  return idx >= 0 ? value.slice(idx + "base64,".length) : value;
}

/** Convierte un data URI / base64 crudo a Buffer. */
export function dataUriToBuffer(value: string): Buffer {
  return Buffer.from(stripDataUri(value), "base64");
}

/** Garantiza el prefijo data URI para imágenes base64 crudas. */
export function toDataUri(value: string, mimeType = "image/jpeg"): string {
  return value.startsWith("data:") ? value : `data:${mimeType};base64,${value}`;
}

const LONG_STRING_THRESHOLD = 200;

/** Reemplaza cadenas largas (probable contenido base64/imagen) por un marcador, para mostrar
 * los datos de un paso en una tabla legible en vez de un volcado JSON con bloques base64
 * ilegibles. Las imágenes reales se muestran aparte en la pestaña "Reporte". */
export function sanitizeStepData(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || value === undefined) return value;
  if (typeof value === "string") {
    return value.length > LONG_STRING_THRESHOLD ? "[contenido binario — ver pestaña Reporte]" : value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeStepData(item, depth + 1));
  }
  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      result[key] = sanitizeStepData(val, depth + 1);
    }
    return result;
  }
  return value;
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

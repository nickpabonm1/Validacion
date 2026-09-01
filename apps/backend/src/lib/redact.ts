const SENSITIVE_KEY_PATTERN =
  /password|secret|token|authorization|apikey|api_key|^key$|^vector$|encrypted/i;

/**
 * Redacta recursivamente cualquier clave sensible antes de loggear un objeto. Se usa en el
 * logger central y en el adaptador FAD para nunca imprimir credenciales, tokens, key/vector o
 * payloads biométricos completos (ver docs/security-decisions.md).
 */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[TRUNCATED]";
  if (Array.isArray(value)) {
    return value.map((item) => redact(item, depth + 1));
  }
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        result[key] = "[REDACTED]";
      } else if (typeof val === "string" && val.length > 2000) {
        result[key] = `[TRUNCATED ${val.length} chars]`;
      } else {
        result[key] = redact(val, depth + 1);
      }
    }
    return result;
  }
  return value;
}

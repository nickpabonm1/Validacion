/**
 * Helpers de (de)serialización para las columnas `String` que representan JSON en SQLite (el
 * conector SQLite de Prisma no soporta el tipo `Json` nativo, ver prisma/schema.prisma).
 */
export function toJsonField(value: unknown): string {
  return JSON.stringify(value ?? null);
}

export function fromJsonField<T = unknown>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

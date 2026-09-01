/**
 * Construye el enlace público que el cliente final usa para realizar el proceso de validación,
 * sustituyendo los placeholders `{validationId}`, `{key}` y `{vector}` en la plantilla configurada
 * por un administrador en Ambientes (`ApiEnvironment.launchUrlTemplate`). Si la plantilla requiere
 * `key`/`vector` y todavía no han sido revelados en la sesión actual, no se construye el enlace
 * (evita mostrar un enlace roto con placeholders sin reemplazar).
 */
export function buildLaunchUrl(
  template: string | null | undefined,
  validationId: string | null,
  revealed: { key?: string; vector?: string },
): string | null {
  if (!template) return null;
  if ((template.includes("{key}") && !revealed.key) || (template.includes("{vector}") && !revealed.vector)) return null;
  return template
    .replaceAll("{validationId}", validationId ?? "")
    .replaceAll("{key}", revealed.key ?? "")
    .replaceAll("{vector}", revealed.vector ?? "");
}

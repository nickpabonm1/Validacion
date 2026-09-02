export function joinUrl(baseUrl: string, pathTemplate: string): string {
  const base = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const suffix = pathTemplate.startsWith("/") ? pathTemplate : `/${pathTemplate}`;
  return `${base}${suffix}`;
}

/** Sustituye el placeholder literal `{validationId}` en la plantilla de endpoint configurada por
 * ambiente (ver ApiEnvironmentInputSchema, que ya exige este placeholder al guardar). Si el
 * placeholder no está presente — un ambiente guardado antes de esa validación, con una URL de
 * ejemplo ya resuelta pegada por error — `.replace()` no encontraría nada que sustituir y
 * devolvería la plantilla intacta: TODAS las ejecuciones terminarían consultando esa misma
 * validación fija sin ningún error visible (bug real detectado en producción: FAD reporta "la
 * validation no existe" para cualquier ejecución). Se lanza aquí en vez de fallar en silencio. */
export function withValidationId(pathTemplate: string, validationId: string): string {
  if (!pathTemplate.includes("{validationId}")) {
    throw new Error(
      `El endpoint configurado ("${pathTemplate}") no contiene el placeholder {validationId} — revisa Ambientes > Endpoints.`,
    );
  }
  return pathTemplate.replace("{validationId}", encodeURIComponent(validationId));
}

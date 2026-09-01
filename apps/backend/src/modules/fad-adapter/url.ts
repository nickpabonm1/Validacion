export function joinUrl(baseUrl: string, pathTemplate: string): string {
  const base = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const suffix = pathTemplate.startsWith("/") ? pathTemplate : `/${pathTemplate}`;
  return `${base}${suffix}`;
}

export function withValidationId(pathTemplate: string, validationId: string): string {
  return pathTemplate.replace("{validationId}", encodeURIComponent(validationId));
}

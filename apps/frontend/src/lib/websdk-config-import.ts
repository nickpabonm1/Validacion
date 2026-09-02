import { WebSdkConfigInputSchema, type WebSdkConfigInput } from "@fad-console/validation-schemas";

export interface WebSdkConfigImportResult {
  values: Partial<WebSdkConfigInput>;
  matched: string[];
  warnings: string[];
}

const KNOWN_KEYS = Object.keys(WebSdkConfigInputSchema.shape) as (keyof WebSdkConfigInput)[];

/**
 * Parsea un archivo JSON de configuración Web SDK (credenciales de Acuant/Facetec, endpoints y
 * parametrización del SDK) subido por el operador — mismo shape que `WebSdkConfigInput` (ver
 * `docs/examples/websdk-config.example.json`). A diferencia del import de colecciones de Postman
 * (que interpreta un archivo ajeno por patrones heurísticos), este es el formato propio de la
 * consola: solo se aplican los campos que el archivo trae explícitamente y que superan la
 * validación de su propio campo — el resto del formulario queda intacto, mismo principio
 * "vacío/ausente = no cambiar" que el resto de imports de esta consola.
 */
export function parseWebSdkConfigImport(raw: unknown): WebSdkConfigImportResult {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { values: {}, matched: [], warnings: ["El archivo no es un objeto JSON válido."] };
  }
  const rawObj = raw as Record<string, unknown>;
  const warnings: string[] = [];
  const matched: string[] = [];
  const values: Partial<WebSdkConfigInput> = {};

  for (const key of KNOWN_KEYS) {
    if (!(key in rawObj)) continue;
    const fieldSchema = WebSdkConfigInputSchema.shape[key];
    const result = fieldSchema.safeParse(rawObj[key]);
    if (result.success) {
      (values as Record<string, unknown>)[key] = result.data;
      matched.push(key);
    } else {
      warnings.push(`Campo «${key}» con formato inválido: se ignoró.`);
    }
  }

  for (const key of Object.keys(rawObj)) {
    if (!KNOWN_KEYS.includes(key as keyof WebSdkConfigInput)) {
      warnings.push(`Campo desconocido «${key}» ignorado.`);
    }
  }

  return { values, matched, warnings };
}

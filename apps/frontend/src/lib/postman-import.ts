import type { ApiEnvironmentInput } from "@fad-console/validation-schemas";

/**
 * Extrae de una colección de Postman (schema v2.1, la misma forma que
 * `FAD-BIOMETRICS-ValidationSteps Autentic COL UATHA` documentada en
 * docs/technical-analysis.md) los campos de un `ApiEnvironmentInput` que se puedan reconocer:
 * URL base, endpoints, método HTTP de `getValidationStep` y credenciales (usuario/contraseña
 * Basic Auth del header `Authorization`, usuario/contraseña de la API y `grant_type` del body
 * form-urlencoded de la solicitud de autenticación). Nunca asume una forma fija de nombres de
 * carpeta/solicitud: busca por patrones en el nombre y en la URL, tal como se hizo al analizar
 * la colección real para este proyecto (ver docs/technical-analysis.md §1).
 */

interface PostmanUrlVariable {
  key?: string;
  value?: string;
}

interface PostmanUrl {
  raw?: string;
  variable?: PostmanUrlVariable[];
}

interface PostmanKeyValue {
  key?: string;
  value?: string;
  disabled?: boolean;
}

interface PostmanAuth {
  type?: string;
  basic?: PostmanKeyValue[];
}

interface PostmanBody {
  mode?: string;
  urlencoded?: PostmanKeyValue[];
  raw?: string;
}

interface PostmanRequest {
  method?: string;
  header?: PostmanKeyValue[];
  url?: string | PostmanUrl;
  body?: PostmanBody;
  auth?: PostmanAuth;
}

interface PostmanItem {
  name?: string;
  item?: PostmanItem[];
  request?: PostmanRequest;
}

interface PostmanCollection {
  info?: { name?: string };
  item?: PostmanItem[];
  variable?: PostmanUrlVariable[];
  auth?: PostmanAuth;
}

interface FlatRequest {
  name: string;
  method: string;
  rawUrl: string;
  header: PostmanKeyValue[];
  body: PostmanBody | undefined;
  auth: PostmanAuth | undefined;
}

export interface PostmanImportMatch {
  field: keyof ApiEnvironmentInput;
  label: string;
  value: string;
  sourceRequestName: string;
}

export interface PostmanImportResult {
  collectionName: string;
  values: Partial<ApiEnvironmentInput>;
  matched: PostmanImportMatch[];
  warnings: string[];
}

const MUSTACHE = /\{\{\s*([^}]+?)\s*\}\}/g;

function resolveTemplate(value: string, variables: Record<string, string>): string {
  return value.replace(MUSTACHE, (full, name: string) => variables[name.trim()] ?? full);
}

function rawUrlOf(url: string | PostmanUrl | undefined): string {
  if (!url) return "";
  return typeof url === "string" ? url : (url.raw ?? "");
}

function flattenItems(items: PostmanItem[] | undefined, out: FlatRequest[] = []): FlatRequest[] {
  for (const item of items ?? []) {
    if (item.request) {
      out.push({
        name: item.name ?? "(sin nombre)",
        method: (item.request.method ?? "GET").toUpperCase(),
        rawUrl: rawUrlOf(item.request.url),
        header: item.request.header ?? [],
        body: item.request.body,
        auth: item.request.auth,
      });
    }
    if (item.item) flattenItems(item.item, out);
  }
  return out;
}

function findByPattern(requests: FlatRequest[], pattern: RegExp): FlatRequest | undefined {
  return requests.find((r) => pattern.test(r.name) || pattern.test(r.rawUrl));
}

/** Convierte variables de ruta de Postman (`:validationId`) al formato de placeholder de la
 * consola (`{validationId}`), tal como ya se usa en `launchUrlTemplate` y los endpoints
 * configurables del ambiente. */
function toPlaceholderPath(path: string): string {
  return path.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, "{$1}");
}

function pathRelativeToBase(resolvedUrl: string, baseUrl: string | null): string {
  if (baseUrl && resolvedUrl.startsWith(baseUrl)) {
    const rest = resolvedUrl.slice(baseUrl.length);
    return toPlaceholderPath(rest.startsWith("/") ? rest : `/${rest}`);
  }
  try {
    const parsed = new URL(resolvedUrl);
    return toPlaceholderPath(parsed.pathname);
  } catch {
    return toPlaceholderPath(resolvedUrl);
  }
}

function decodeBasicHeader(headerValue: string): { username: string; password: string } | null {
  const match = /^Basic\s+(.+)$/i.exec(headerValue.trim());
  const encoded = match?.[1];
  if (!encoded) return null;
  try {
    const decoded = typeof atob === "function" ? atob(encoded) : Buffer.from(encoded, "base64").toString("utf8");
    const separatorIndex = decoded.indexOf(":");
    if (separatorIndex === -1) return null;
    return { username: decoded.slice(0, separatorIndex), password: decoded.slice(separatorIndex + 1) };
  } catch {
    return null;
  }
}

function findVariableUrl(variables: Record<string, string>): string | null {
  const candidateKeys = Object.keys(variables).filter((key) => /^(base_?url|host|url)$/i.test(key));
  for (const key of candidateKeys) {
    const value = variables[key];
    if (value && /^https?:\/\//i.test(value)) return value.replace(/\/+$/, "");
  }
  return null;
}

function guessBaseUrlFromRequests(requests: FlatRequest[], variables: Record<string, string>): string | null {
  for (const request of requests) {
    const resolved = resolveTemplate(request.rawUrl, variables);
    if (!/^https?:\/\//i.test(resolved)) continue;
    try {
      const parsed = new URL(resolved);
      return `${parsed.protocol}//${parsed.host}`;
    } catch {
      continue;
    }
  }
  return null;
}

export function parsePostmanCollection(raw: unknown): PostmanImportResult {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("El archivo no es un JSON válido de colección de Postman.");
  }
  const collection = raw as PostmanCollection;
  if (!Array.isArray(collection.item)) {
    throw new Error(
      "El archivo no contiene solicitudes (¿es un archivo de Environment de Postman en vez de una Colección? " +
        "Exporta la Colección completa desde Postman e inténtalo de nuevo).",
    );
  }

  const variables: Record<string, string> = {};
  for (const v of collection.variable ?? []) {
    if (v.key && v.value !== undefined) variables[v.key] = v.value;
  }

  const requests = flattenItems(collection.item);
  if (requests.length === 0) {
    throw new Error("La colección no contiene ninguna solicitud (item con `request`).");
  }

  const baseUrl = findVariableUrl(variables) ?? guessBaseUrlFromRequests(requests, variables);

  const values: Partial<ApiEnvironmentInput> = {};
  const matched: PostmanImportMatch[] = [];
  const warnings: string[] = [];

  function set<K extends keyof ApiEnvironmentInput>(field: K, value: ApiEnvironmentInput[K], label: string, sourceRequestName: string) {
    values[field] = value;
    matched.push({ field, label, value: String(value), sourceRequestName });
  }

  if (baseUrl) {
    set("baseUrl", baseUrl, "URL base", "variables de la colección");
  } else {
    warnings.push("No se pudo determinar la URL base automáticamente; complétala manualmente en «Datos generales».");
  }

  const nameLower = (collection.info?.name ?? "").toLowerCase();
  if (/prod/.test(nameLower)) values.environmentType = "PRODUCTION";
  else if (/\bqa\b/.test(nameLower)) values.environmentType = "QA";

  const authRequest = findByPattern(requests, /oauth[/-]?token|authorization-server|\bauth\b|\btoken\b/i);
  if (authRequest) {
    set(
      "authTokenEndpoint",
      pathRelativeToBase(resolveTemplate(authRequest.rawUrl, variables), baseUrl),
      "Endpoint de autenticación",
      authRequest.name,
    );

    let basicCreds: { username: string; password: string } | null = null;
    const basicAuthEntries = authRequest.auth?.type === "basic" ? authRequest.auth.basic ?? [] : [];
    const usernameEntry = basicAuthEntries.find((e) => e.key === "username");
    const passwordEntry = basicAuthEntries.find((e) => e.key === "password");
    if (usernameEntry?.value !== undefined) {
      basicCreds = { username: resolveTemplate(usernameEntry.value, variables), password: resolveTemplate(passwordEntry?.value ?? "", variables) };
    } else {
      const authHeader = authRequest.header.find((h) => h.key?.toLowerCase() === "authorization" && !h.disabled);
      if (authHeader?.value) {
        basicCreds = decodeBasicHeader(resolveTemplate(authHeader.value, variables));
      }
    }
    if (basicCreds) {
      set("basicAuthUsername", basicCreds.username, "Usuario Basic Auth", authRequest.name);
      if (basicCreds.password) {
        set("basicAuthPassword", basicCreds.password, "Contraseña Basic Auth", authRequest.name);
        warnings.push("Se detectó una contraseña Basic Auth en la colección: revísala antes de guardar (podría estar en formato de ejemplo, no la real).");
      }
    }

    if (authRequest.body?.mode === "urlencoded") {
      const entries = authRequest.body.urlencoded ?? [];
      const grantType = entries.find((e) => e.key === "grant_type")?.value;
      const apiUsername = entries.find((e) => e.key === "username")?.value;
      const apiPassword = entries.find((e) => e.key === "password")?.value;
      if (grantType) set("grantType", resolveTemplate(grantType, variables), "Grant type", authRequest.name);
      if (apiUsername) set("apiUsername", resolveTemplate(apiUsername, variables), "Usuario de la API", authRequest.name);
      if (apiPassword) {
        set("apiPassword", resolveTemplate(apiPassword, variables), "Contraseña de la API", authRequest.name);
        warnings.push(
          "Se detectó una contraseña de API en la colección: verifica si ya viene cifrada con SHA-256 y marca " +
            "«La contraseña ya está cifrada» si corresponde.",
        );
      }
    }
  } else {
    warnings.push("No se encontró una solicitud de autenticación (OAuth/token) reconocible en la colección.");
  }

  const createValidationRequest = findByPattern(requests, /createvalidation|biometrics-by-steps\/validations/i);
  if (createValidationRequest) {
    set(
      "createValidationEndpoint",
      pathRelativeToBase(resolveTemplate(createValidationRequest.rawUrl, variables), baseUrl),
      "Endpoint crear validación",
      createValidationRequest.name,
    );
  }

  const saveStepRequest = findByPattern(requests, /savevalidationstep/i);
  if (saveStepRequest) {
    set(
      "saveValidationStepEndpoint",
      pathRelativeToBase(resolveTemplate(saveStepRequest.rawUrl, variables), baseUrl),
      "Endpoint guardar paso",
      saveStepRequest.name,
    );
  }

  const getStepRequest = findByPattern(requests, /getvalidationstep/i);
  if (getStepRequest) {
    set(
      "getValidationStepEndpoint",
      pathRelativeToBase(resolveTemplate(getStepRequest.rawUrl, variables), baseUrl),
      "Endpoint consultar pasos",
      getStepRequest.name,
    );
    if (getStepRequest.method === "GET" || getStepRequest.method === "POST") {
      set("getValidationStepHttpMethod", getStepRequest.method, "Método HTTP de consultar pasos", getStepRequest.name);
    }
  }

  const getDataRequest = findByPattern(requests, /getvalidationdata/i);
  if (getDataRequest) {
    set(
      "getValidationDataEndpoint",
      pathRelativeToBase(resolveTemplate(getDataRequest.rawUrl, variables), baseUrl),
      "Endpoint consultar información detallada",
      getDataRequest.name,
    );
  }

  if (matched.some((m) => typeof m.value === "string" && m.value.includes("{{"))) {
    warnings.push(
      "Algunos valores importados todavía contienen variables sin resolver (\"{{...}}\"): probablemente estén " +
        "definidas en un archivo de Environment de Postman separado que no se importó.",
    );
  }

  return { collectionName: collection.info?.name ?? "Colección sin nombre", values, matched, warnings };
}

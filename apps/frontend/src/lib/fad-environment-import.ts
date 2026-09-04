import JSON5 from "json5";
import { ApiEnvironmentInputSchema, WebSdkConfigInputSchema, type ApiEnvironmentInput, type WebSdkConfigInput } from "@fad-console/validation-schemas";

/**
 * Importa credenciales/endpoints desde el `environment.ts` de los proyectos de ejemplo del
 * proveedor (fad-demo-v1/v2, Angular `FadConfig`) — no hace falta copiar cada campo a mano. El
 * archivo trae `import`/`export const`/comentarios/comillas simples/claves sin comillas: no es
 * JSON válido, así que primero se extrae el objeto literal y se interpreta con JSON5 (sin
 * `eval`/`Function`, JSON5 solo produce datos, nunca ejecuta código). Solo se aplican los campos
 * reconocidos (auth/sdk/acuant/regula/facetec) que además pasan la validación de su propio campo
 * — mismo principio "vacío/ausente = no cambiar" que el resto de imports de esta consola. Nunca
 * persiste nada por sí solo: solo llena el formulario, el operador revisa y guarda.
 */

/** Busca el primer `{` que abre el objeto exportado (`export const x: Tipo = { ... }` o
 * `export default { ... }`) y devuelve el índice de su `}` correspondiente, contando profundidad
 * de llaves pero saltándose strings/comentarios para no confundirse con un `{`/`}` dentro de un
 * texto. Devuelve `null` si no encuentra un cierre balanceado. */
function findMatchingBraceEnd(source: string, openIndex: number): number | null {
  let depth = 0;
  let i = openIndex;
  const n = source.length;
  while (i < n) {
    const ch = source[i];
    if (ch === "/" && source[i + 1] === "/") {
      i += 2;
      while (i < n && source[i] !== "\n") i++;
      continue;
    }
    if (ch === "/" && source[i + 1] === "*") {
      i += 2;
      while (i < n && !(source[i] === "*" && source[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") {
      const quote = ch;
      i++;
      while (i < n && source[i] !== quote) {
        i += source[i] === "\\" ? 2 : 1;
      }
      i++;
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return i;
    }
    i++;
  }
  return null;
}

/** Extrae el texto del objeto literal exportado por un archivo `environment.ts` tipo Angular
 * (`export const <nombre>[: Tipo] = { ... };` o `export default { ... };`). Devuelve `null` si no
 * encuentra ese patrón — el archivo subido no es de este tipo. */
export function extractExportedObjectLiteral(source: string): string | null {
  const declMatch = /export\s+(?:default\s+)?const\s+[A-Za-z_$][\w$]*\s*(?::[^=]+)?=\s*/.exec(source);
  const defaultMatch = declMatch ? null : /export\s+default\s+/.exec(source);
  const startIndex = declMatch
    ? declMatch.index + declMatch[0].length
    : defaultMatch
      ? defaultMatch.index + defaultMatch[0].length
      : source.indexOf("{");
  if (startIndex < 0 || source[startIndex] !== "{") return null;
  const endIndex = findMatchingBraceEnd(source, startIndex);
  if (endIndex === null) return null;
  return source.slice(startIndex, endIndex + 1);
}

/** Interpreta el texto de un `environment.ts` del proveedor y devuelve el objeto ya parseado (con
 * JSON5, sin ejecutar código). `null` si el archivo no trae un objeto reconocible o no se pudo
 * interpretar. */
export function parseFadEnvironmentObject(text: string): Record<string, unknown> | null {
  const literal = extractExportedObjectLiteral(text);
  if (!literal) return null;
  try {
    const parsed: unknown = JSON5.parse(literal);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

export interface FadEnvironmentImportResult {
  environmentValues: Partial<ApiEnvironmentInput>;
  webSdkValues: Partial<WebSdkConfigInput>;
  matched: string[];
  warnings: string[];
}

function getPath(root: Record<string, unknown>, path: string[]): unknown {
  let cur: unknown = root;
  for (const key of path) {
    if (typeof cur !== "object" || cur === null) return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

/**
 * Mapea el objeto `FadConfig` del proveedor (auth/sdk/acuant/regula/facetec) a los campos planos
 * de `ApiEnvironmentInput` (pestaña «Autenticación OAuth») y `WebSdkConfigInput` (pestaña «Web
 * SDK») de esta consola — ver la tabla de equivalencias en la documentación de Ambientes. Cada
 * valor se valida con el schema de su propio campo antes de aplicarse; lo que no calza queda como
 * advertencia y el resto del formulario no se toca.
 */
export function parseFadEnvironmentImport(rawText: string): FadEnvironmentImportResult {
  const root = parseFadEnvironmentObject(rawText);
  const matched: string[] = [];
  const warnings: string[] = [];
  const environmentValues: Partial<ApiEnvironmentInput> = {};
  const webSdkValues: Partial<WebSdkConfigInput> = {};

  if (!root) {
    return {
      environmentValues,
      webSdkValues,
      matched,
      warnings: [
        "No se reconoció el archivo como un environment.ts del proyecto de ejemplo del proveedor " +
          "(se esperaba `export const <nombre> = { ... }` con secciones auth/sdk/acuant/regula/facetec).",
      ],
    };
  }

  function applyEnv<K extends keyof ApiEnvironmentInput>(path: string[], field: K) {
    const raw = getPath(root!, path);
    if (raw === undefined || raw === "") return;
    const result = ApiEnvironmentInputSchema.shape[field].safeParse(raw);
    if (result.success) {
      (environmentValues as Record<string, unknown>)[field] = result.data;
      matched.push(`${path.join(".")} → ${field}`);
    } else {
      warnings.push(`«${path.join(".")}» tiene un formato inválido para «${field}»: se ignoró.`);
    }
  }

  function applySdk<K extends keyof WebSdkConfigInput>(path: string[], field: K) {
    const raw = getPath(root!, path);
    if (raw === undefined || raw === "") return;
    const result = WebSdkConfigInputSchema.shape[field].safeParse(raw);
    if (result.success) {
      (webSdkValues as Record<string, unknown>)[field] = result.data;
      matched.push(`${path.join(".")} → ${field}`);
    } else {
      warnings.push(`«${path.join(".")}» tiene un formato inválido para «${field}»: se ignoró.`);
    }
  }

  applyEnv(["auth", "basic", "clientId"], "basicAuthUsername");
  applyEnv(["auth", "basic", "clientSecret"], "basicAuthPassword");
  applyEnv(["auth", "user", "username"], "apiUsername");
  applyEnv(["auth", "user", "password"], "apiPassword");
  applyEnv(["auth", "user", "passwordIsHashed"], "passwordIsPreHashed");
  applyEnv(["auth", "user", "grantType"], "grantType");

  applySdk(["sdk", "token"], "sdkToken");
  applySdk(["sdk", "baseUrl"], "sdkBaseUrl");
  applySdk(["sdk", "requestId"], "sdkRequestId");

  applySdk(["acuant", "credentials", "passiveUsername"], "acuantPassiveUsername");
  applySdk(["acuant", "credentials", "passivePassword"], "acuantPassivePassword");
  applySdk(["acuant", "credentials", "passiveSubscriptionId"], "acuantPassiveSubscriptionId");
  applySdk(["acuant", "credentials", "acasEndpoint"], "acuantAcasEndpoint");
  applySdk(["acuant", "credentials", "livenessEndpoint"], "acuantLivenessEndpoint");
  applySdk(["acuant", "credentials", "assureidEndpoint"], "acuantAssureidEndpoint");

  applySdk(["regula", "credentials", "license"], "regulaLicense");
  applySdk(["regula", "credentials", "apiBasePath"], "regulaApiBasePath");

  applySdk(["facetec", "credentials", "deviceKeyIdentifier"], "facetecDeviceKeyIdentifier");
  applySdk(["facetec", "credentials", "publicFaceScanEncryptionKey"], "facetecPublicFaceScanEncryptionKey");
  applySdk(["facetec", "useMiddleware"], "facetecUseMiddleware");

  const productionKeyText = getPath(root, ["facetec", "credentials", "productionKeyText"]);
  if (productionKeyText && typeof productionKeyText === "object") {
    const pkt = productionKeyText as Record<string, unknown>;
    if (pkt.domains || pkt.expiryDate || pkt.key) {
      const result = WebSdkConfigInputSchema.shape.facetecProductionKeyText.safeParse({
        domains: pkt.domains ?? "",
        expiryDate: pkt.expiryDate ?? "",
        key: pkt.key ?? "",
      });
      if (result.success) {
        webSdkValues.facetecProductionKeyText = result.data;
        matched.push("facetec.credentials.productionKeyText → facetecProductionKeyText");
      } else {
        warnings.push("«facetec.credentials.productionKeyText» tiene un formato inválido: se ignoró.");
      }
    }
  }

  if (matched.length === 0) {
    warnings.push("No se encontró ningún campo reconocido (auth/sdk/acuant/regula/facetec) en el archivo.");
  }

  return { environmentValues, webSdkValues, matched, warnings };
}

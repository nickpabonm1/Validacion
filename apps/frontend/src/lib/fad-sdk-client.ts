import FadSDK from "@fad-producto/fad-sdk";
import type { WebSdkSessionInitDto } from "@fad-console/shared-types";
import type { WebSdkAcuantResultInput, WebSdkFacetecResultInput } from "@fad-console/validation-schemas";

/**
 * Wrapper delgado de `@fad-producto/fad-sdk` (inyecta los módulos Acuant/Facetec en un iframe en
 * el navegador). Puerto de `fad-demo-v1/src/app/services/fad-sdk.service.ts` — misma forma de
 * invocación, verificada contra UATHA. Normaliza el resultado a la forma que espera el backend
 * (`WebSdkAcuantResultInput` / `WebSdkFacetecResultInput`), lista para reportarse a
 * `/executions/websdk/:id/acuant-result` y `/facetec-result`.
 */
let sdk: FadSDK | null = null;

function initSdk(init: WebSdkSessionInitDto): FadSDK {
  const environment = init.sdkEnvironment === "PROD" ? FadSDK.getFadEnvironments().PROD : FadSDK.getFadEnvironments().UATHA;
  sdk = init.sdkRequestId
    ? new FadSDK(init.sdkToken, { environment, baseUrl: init.sdkBaseUrl, metrics: { requestId: init.sdkRequestId } })
    : new FadSDK(init.sdkToken, { environment, baseUrl: init.sdkBaseUrl });
  return sdk;
}

function toDataUri(value: string | undefined | null): string | undefined {
  if (!value) return undefined;
  return value.startsWith("data:") ? value : `data:image/jpeg;base64,${value}`;
}

/** Ejecuta la captura de identificación con Acuant (iframe). */
export async function runAcuantCapture(init: WebSdkSessionInitDto): Promise<WebSdkAcuantResultInput> {
  const client = initSdk(init);
  try {
    const { credentials, params, configuration } = init.acuant;
    const response = await client.startAcuant(credentials, params.idData, params.idPhoto, params.manualCapture, configuration);
    const data = (response?.data ?? {}) as Record<string, unknown>;
    const id = (data.id ?? {}) as Record<string, unknown>;
    const front = (id.front as Record<string, unknown> | undefined)?.image as Record<string, unknown> | undefined;
    const back = (id.back as Record<string, unknown> | undefined)?.image as Record<string, unknown> | undefined;
    return {
      frontImage: toDataUri(front?.data as string | undefined),
      backImage: toDataUri(back?.data as string | undefined),
      idPhoto: toDataUri(data.idPhoto as string | undefined),
      documentInstance: data.documentInstance as string | undefined,
      ocr: (data.idData as Record<string, unknown> | undefined)?.ocr as Record<string, unknown> | undefined,
    };
  } finally {
    endSdk();
  }
}

/** Ejecuta la prueba de vida con Facetec (iframe, vía middleware o credenciales directas). */
export async function runFacetecCapture(init: WebSdkSessionInitDto): Promise<WebSdkFacetecResultInput> {
  const client = initSdk(init);
  try {
    const { useMiddleware, middleware, credentials, configuration } = init.facetec;
    const response = useMiddleware
      ? await client.startFacetec(null, configuration, { useMiddleware: true, ...middleware })
      : await client.startFacetec(credentials, configuration);
    const data = (response?.data ?? {}) as Record<string, unknown>;
    const auditTrail = Array.isArray(data.auditTrail) ? (data.auditTrail as string[]) : [];
    const selfie = (data.selfie as string | undefined) ?? auditTrail[0];
    return {
      selfie: toDataUri(selfie),
      faceScan: (data.faceScan as string | null | undefined) ?? null,
      auditTrail: auditTrail.map((img) => toDataUri(img)).filter((v): v is string => Boolean(v)),
      lowQualityAuditTrail: Array.isArray(data.lowQualityAuditTrail)
        ? (data.lowQualityAuditTrail as string[]).map((img) => toDataUri(img)).filter((v): v is string => Boolean(v))
        : [],
      sessionId: (data.sessionId as string | null | undefined) ?? null,
      status: data.status as number | undefined,
    };
  } finally {
    endSdk();
  }
}

/** Termina el proceso del SDK y limpia el iframe. */
export function endSdk(): void {
  try {
    sdk?.end();
  } catch {
    // noop: el SDK puede lanzar si ya se cerró
  }
}

/** Describe un error del SDK (código + nombre de constante conocida) para mostrarlo al operador. */
export function describeSdkError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    if (typeof record.message === "string") return record.message;
    if (typeof record.description === "string") return record.description;
    if (record.code !== undefined) return `Error del SDK (code=${String(record.code)})`;
  }
  return "Error desconocido del SDK";
}

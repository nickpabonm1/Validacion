import FadSDK from "@fad-producto/fad-sdk";
import type { WebSdkSessionInitDto } from "@fad-console/shared-types";
import type { WebSdkAcuantResultInput, WebSdkFacetecResultInput, WebSdkImageQuality } from "@fad-console/validation-schemas";

/**
 * Wrapper delgado de `@fad-producto/fad-sdk` (inyecta los módulos Acuant/Facetec en un iframe en
 * el navegador). Puerto de `fad-demo-v1/src/app/services/fad-sdk.service.ts` — misma forma de
 * invocación, verificada contra UATHA. Normaliza el resultado a la forma que espera el backend
 * (`WebSdkAcuantResultInput` / `WebSdkFacetecResultInput`), lista para reportarse a
 * `/executions/websdk/:id/acuant-result` y `/facetec-result`. Extrae **todo** lo que documenta
 * el PDF "FAD SDK Web Acuant" §3.7 (Result) — no solo las imágenes de captura: también las
 * métricas de calidad por lado, `validation`, `classification`, `alerts`, y cualquier imagen
 * embebida dentro de `idData.ocr` (photo/signature/fingerprint) — para que el reporte muestre
 * cada imagen como imagen, nunca como texto base64.
 */
let sdk: FadSDK | null = null;

function initSdk(init: WebSdkSessionInitDto): FadSDK {
  const environment = init.sdkEnvironment === "PROD" ? FadSDK.getFadEnvironments().PROD : FadSDK.getFadEnvironments().UATHA;
  sdk = init.sdkRequestId
    ? new FadSDK(init.sdkToken, { environment, baseUrl: init.sdkBaseUrl, metrics: { requestId: init.sdkRequestId } })
    : new FadSDK(init.sdkToken, { environment, baseUrl: init.sdkBaseUrl });
  return sdk;
}

export function toDataUri(value: string | undefined | null, mimeType = "image/jpeg"): string | undefined {
  if (!value) return undefined;
  return value.startsWith("data:") ? value : `data:${mimeType};base64,${value}`;
}

const OCR_IMAGE_FIELDS = ["photo", "signature", "fingerprint"] as const;

/** Una cadena "parece" una imagen base64 embebida si es larga y solo tiene caracteres base64
 * (con o sin el prefijo data URI) — la misma heurística de longitud que usa
 * `apps/backend/src/normalize/media.ts` para el modelo API-by-steps. */
function looksLikeBase64Image(value: unknown): value is string {
  if (typeof value !== "string" || value.length < 100) return false;
  const raw = value.includes("base64,") ? value.slice(value.indexOf("base64,") + "base64,".length) : value;
  return /^[A-Za-z0-9+/]+={0,2}$/.test(raw);
}

interface SplitOcrResult {
  ocr: Record<string, unknown> | undefined;
  ocrPhoto?: string;
  ocrSignature?: string;
  ocrFingerprint?: string;
}

/** Separa las imágenes embebidas dentro de `idData.ocr` (campos `photo`/`signature`/
 * `fingerprint`, documentados como `string` en el PDF pero que en la práctica traen base64) del
 * resto de los campos de texto, para que nunca terminen mostrándose como texto crudo en la
 * tabla de OCR — se muestran como imágenes reales en la galería. Función pura, sin llamadas al
 * SDK, para poder probarse con datos de ejemplo. */
export function splitOcrImages(ocr: Record<string, unknown> | undefined): SplitOcrResult {
  if (!ocr) return { ocr: undefined };
  const rest: Record<string, unknown> = { ...ocr };
  const result: SplitOcrResult = { ocr: rest };
  for (const field of OCR_IMAGE_FIELDS) {
    const value = rest[field];
    if (looksLikeBase64Image(value)) {
      const outKey = `ocr${field[0]!.toUpperCase()}${field.slice(1)}` as "ocrPhoto" | "ocrSignature" | "ocrFingerprint";
      result[outKey] = toDataUri(value);
      delete rest[field];
    }
  }
  if (Object.keys(rest).length === 0) result.ocr = undefined;
  return result;
}

function readImageQuality(image: Record<string, unknown> | undefined): WebSdkImageQuality | undefined {
  if (!image) return undefined;
  const quality: WebSdkImageQuality = {
    glare: typeof image.glare === "number" ? image.glare : undefined,
    dpi: typeof image.dpi === "number" ? image.dpi : undefined,
    sharpness: typeof image.sharpness === "number" ? image.sharpness : undefined,
    moire: typeof image.moire === "number" ? image.moire : undefined,
    moireraw: typeof image.moireraw === "number" ? image.moireraw : undefined,
    cardType: typeof image.cardType === "number" ? image.cardType : undefined,
  };
  return Object.values(quality).some((v) => v !== undefined) ? quality : undefined;
}

/** Ejecuta la captura de identificación con Acuant (iframe). */
export async function runAcuantCapture(init: WebSdkSessionInitDto): Promise<WebSdkAcuantResultInput> {
  const client = initSdk(init);
  try {
    const { credentials, params, configuration } = init.acuant;
    const response = await client.startAcuant(credentials, params.idData, params.idPhoto, params.manualCapture, configuration);
    const data = (response?.data ?? {}) as Record<string, unknown>;
    const id = (data.id ?? {}) as Record<string, unknown>;
    const front = (id.front ?? {}) as Record<string, unknown>;
    const back = (id.back ?? {}) as Record<string, unknown>;
    const idData = (data.idData ?? {}) as Record<string, unknown>;
    const { ocr, ocrPhoto, ocrSignature, ocrFingerprint } = splitOcrImages(idData.ocr as Record<string, unknown> | undefined);

    return {
      frontImage: toDataUri((front.image as Record<string, unknown> | undefined)?.data as string | undefined),
      backImage: toDataUri((back.image as Record<string, unknown> | undefined)?.data as string | undefined),
      idPhoto: toDataUri(data.idPhoto as string | undefined),
      documentInstance: data.documentInstance as string | undefined,
      ocr,
      ocrPhoto,
      ocrSignature,
      ocrFingerprint,
      validation: idData.validation as Record<string, unknown> | undefined,
      classification: idData.classification as Record<string, unknown> | undefined,
      alerts: Array.isArray(idData.alerts) ? (idData.alerts as Record<string, unknown>[]) : undefined,
      frontQuality: readImageQuality(front),
      backQuality: readImageQuality(back),
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

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
    const acuant = init.acuant;
    if (!acuant) throw new Error("Falta la configuración de Acuant en la sesión del SDK.");
    const { credentials, params, configuration } = acuant;
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

const REGULA_ALERT_CATEGORIES = ["authenticity", "dateChecks", "imageQuality", "mrzCheckDigit", "textCrossChecks"] as const;

/** Regula devuelve `alerts` como un objeto agrupado por categoría (cada una un array) — ver "FAD
 * SDK Web Regula" §Result — a diferencia del array plano de Acuant. Se aplana a un array único
 * con `category` en cada elemento para reutilizar el mismo campo `alerts` (y el mismo
 * renderizador del reporte) sin importar el motor de captura. Función pura, sin llamadas al SDK,
 * para poder probarse con datos de ejemplo. */
export function flattenRegulaAlerts(alerts: Record<string, unknown> | undefined): Record<string, unknown>[] {
  if (!alerts) return [];
  const flat: Record<string, unknown>[] = [];
  for (const category of REGULA_ALERT_CATEGORIES) {
    const entries = alerts[category];
    if (!Array.isArray(entries)) continue;
    for (const entry of entries) {
      flat.push(typeof entry === "object" && entry !== null ? { category, ...entry } : { category, value: entry });
    }
  }
  return flat;
}

/** Ejecuta la captura de identificación con Regula (iframe). Puerto de "FAD SDK Web Regula"
 * §Initiate the Process / §Result — la respuesta se normaliza a la misma forma que
 * `runAcuantCapture` (`WebSdkAcuantResultInput`) para que el resto del flujo (NAAT-CHECK,
 * compareFacesPassive, saveValidationData) funcione igual sin importar el motor de captura.
 * Importante: el orden de argumentos de `startRegula` en el paquete instalado
 * (`credentials, captureType, idData, idPhoto, configuration`) difiere del ejemplo de código del
 * PDF (`credentials, idData, idPhoto, captureType, configuration`) — se sigue la firma real del
 * paquete `@fad-producto/fad-sdk`, que es lo que efectivamente se ejecuta. */
export async function runRegulaCapture(init: WebSdkSessionInitDto): Promise<WebSdkAcuantResultInput> {
  const client = initSdk(init);
  try {
    const regula = init.regula;
    if (!regula) throw new Error("Falta la configuración de Regula en la sesión del SDK.");
    // `RegulaCaptureType` es un enum del paquete `@fad-producto/fad-sdk` (no está re-exportado en
    // el nivel superior del paquete, solo vía `FadSDK.Constants.Regula.CaptureType`); como los
    // valores del enum son idénticos a sus llaves ("CAMERA_SNAPSHOT"/"DOCUMENT_READER"), indexar
    // por llave da el valor tipado correcto sin un cast inseguro.
    const captureType = FadSDK.Constants.Regula.CaptureType[regula.captureType];
    const response = await client.startRegula(regula.credentials, captureType, regula.idData, regula.idPhoto, regula.configuration);
    const data = (response?.data ?? {}) as Record<string, unknown>;
    const id = (data.id ?? {}) as Record<string, unknown>;
    const idData = (data.idData ?? {}) as Record<string, unknown>;
    const { ocr, ocrPhoto, ocrSignature, ocrFingerprint } = splitOcrImages(idData.ocr as Record<string, unknown> | undefined);
    // `alerts` viaja junto a `event`/`data` en la respuesta (ver "FAD SDK Web Regula" §Result),
    // pero `ResponseModule` (el tipo declarado por el paquete) no lo declara — se toma con un
    // cast puntual, no se fabrica el dato.
    const responseWithAlerts = response as unknown as { alerts?: Record<string, unknown> };
    const alerts = flattenRegulaAlerts(responseWithAlerts?.alerts);

    return {
      // A diferencia de Acuant (`id.front.image.data`), Regula devuelve `id.front`/`id.back`
      // directamente como string base64.
      frontImage: toDataUri(id.front as string | undefined),
      backImage: toDataUri(id.back as string | undefined),
      idPhoto: toDataUri(data.idPhoto as string | undefined),
      originalPhoto: toDataUri(data.originalPhoto as string | undefined),
      ocr,
      ocrPhoto,
      ocrSignature,
      ocrFingerprint,
      alerts: alerts.length > 0 ? alerts : undefined,
      regulaData: Array.isArray(data.regulaData) ? (data.regulaData as Record<string, unknown>[]) : undefined,
      regulaResponse:
        typeof data.regulaResponse === "object" && data.regulaResponse !== null
          ? (data.regulaResponse as Record<string, unknown>)
          : undefined,
    };
  } finally {
    endSdk();
  }
}

/** Extrae el base64 (string) de una imagen del resultado de CaptureId, tolerando varias formas
 * que trae la respuesta real (string directo, { data }, { image }, { image: { data } },
 * { base64 }, { uri }, { content }, { value }) — mismo tolerante `pickImage` de fad-demo-v2
 * `FadSdkService.mapCaptureId`, necesario porque el PDF "FAD SDK Web CaptureId" no documenta la
 * forma exacta de `data.resources.*`. */
export function pickCaptureIdImage(side: unknown, depth = 0): string | undefined {
  if (side == null) return undefined;
  if (typeof side === "string") return side;
  if (depth >= 4 || typeof side !== "object") return undefined;
  const record = side as Record<string, unknown>;
  const candidates = [record.data, record.image, record.base64, record.uri, record.content, record.value, record.file];
  for (const candidate of candidates) {
    const found = pickCaptureIdImage(candidate, depth + 1);
    if (found) return found;
  }
  return undefined;
}

/** Normaliza `data.ocr` de CaptureId (`{ fields: [{key,value}], decodeInfo: { data: { foto,
 * biograficos } } }`) a los mismos nombres camelCase estilo Acuant que ya consume el resto del
 * flujo (`buildMetadataJson`, `buildWebSdkNormalizedDetail`) — puerto de
 * fad-demo-v2 `FadSdkService.buildCaptureIdOcr`. Se conservan `fields`/`biograficos` crudos para
 * trazabilidad, nunca se descartan. */
export function buildCaptureIdOcr(data: Record<string, unknown>): Record<string, unknown> {
  const ocrRaw = (data.ocr ?? {}) as Record<string, unknown>;
  const fields = Array.isArray(ocrRaw.fields) ? (ocrRaw.fields as { key?: unknown; value?: unknown }[]) : [];
  const byKey: Record<string, unknown> = {};
  for (const f of fields) {
    if (f?.key != null) byKey[String(f.key)] = f.value;
  }
  const decodeInfo = (ocrRaw.decodeInfo ?? {}) as Record<string, unknown>;
  const decodeData = (decodeInfo.data ?? {}) as Record<string, unknown>;
  const bio = (decodeData.biograficos ?? {}) as Record<string, unknown>;

  return {
    fullName: byKey["Full Name"],
    givenName: bio.nombre ?? byKey["Given Names"],
    firstName: bio.nombre ?? byKey["Given Names"],
    fathersSurname: bio.apellido1 ?? byKey["Surname"],
    mothersSurname: bio.apellido2 ?? byKey["Second Surname"],
    curp: bio.curp ?? byKey["Personal Number"],
    personalNumber: bio.curp ?? byKey["Personal Number"],
    documentNumber: byKey["Document Number"] ?? bio.cic,
    expirationDate: byKey["Date of Expiry"],
    registrationYear: byKey["Year of Registration"],
    issuingStateName: byKey["Address State"],
    fields,
    biograficos: bio,
  };
}

/** Ejecuta la captura de identificación con CaptureId (iframe) — "FAD SDK Web CaptureId"
 * §Parameters: `startCaptureId(configuration)` recibe un único parámetro (sin credenciales, a
 * diferencia de Acuant/Regula: se autentica con el `sdkToken` ya usado para construir el SDK). La
 * respuesta se normaliza a la misma forma `WebSdkAcuantResultInput` (puerto de fad-demo-v2
 * `FadSdkService.mapCaptureId`), de modo que el resto del flujo (NAAT-CHECK, compareFacesPassive,
 * saveValidationData) funciona igual sin importar el motor de captura. */
export async function runCaptureIdCapture(init: WebSdkSessionInitDto): Promise<WebSdkAcuantResultInput> {
  const client = initSdk(init);
  try {
    const captureId = init.captureId;
    if (!captureId) throw new Error("Falta la configuración de CaptureId en la sesión del SDK.");
    const response = await client.startCaptureId(captureId.configuration);
    const data = (response?.data ?? {}) as Record<string, unknown>;
    const resources = (data.resources ?? {}) as Record<string, unknown>;
    const croppedId = (resources.croppedId ?? {}) as Record<string, unknown>;
    const originalPhotoSide = (resources.originalPhoto ?? {}) as Record<string, unknown>;

    const dataImage = (data.image ?? {}) as Record<string, unknown>;
    const dataOriginalPhoto = (data.originalPhoto ?? {}) as Record<string, unknown>;
    const ocrDecodeData = (((data.ocr as Record<string, unknown> | undefined)?.decodeInfo as Record<string, unknown> | undefined)?.data ??
      {}) as Record<string, unknown>;

    const frontImage = pickCaptureIdImage(croppedId.front) ?? pickCaptureIdImage(dataImage.front);
    const backImage = pickCaptureIdImage(croppedId.back) ?? pickCaptureIdImage(dataImage.back);
    // Recorte del rostro: `resources.portrait`. Como respaldo, la foto del decodificado del QR
    // (`ocr.decodeInfo.data.foto`), o `data.idPhoto` si el proveedor lo devuelve directo.
    const idPhoto = pickCaptureIdImage(resources.portrait) ?? pickCaptureIdImage(ocrDecodeData.foto) ?? pickCaptureIdImage(data.idPhoto);
    const originalPhoto = pickCaptureIdImage(originalPhotoSide.front) ?? pickCaptureIdImage(dataOriginalPhoto.front);

    return {
      frontImage: toDataUri(frontImage),
      backImage: toDataUri(backImage),
      idPhoto: toDataUri(idPhoto),
      originalPhoto: toDataUri(originalPhoto),
      ocr: buildCaptureIdOcr(data),
      classification: typeof data.classification === "object" && data.classification !== null ? (data.classification as Record<string, unknown>) : undefined,
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

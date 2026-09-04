import type {
  NormalizedDocumentCheck,
  NormalizedFile,
  NormalizedStep,
  NormalizedValidationDetail,
} from "@fad-console/shared-types";
import { STEP_CATALOG } from "@fad-console/shared-types";
import type {
  CreateValidationResponse,
  GetValidationDataResponse,
  GetValidationStepResponse,
} from "@fad-console/validation-schemas";
import { normalizeResult, normalizeStepStatus, normalizeValidationStatus } from "./status";
import { parseFlexibleDate } from "./dates";
import { maskEmail, maskName } from "./mask";
import { extractMediaAssets } from "./media";

interface RequestStepEntry {
  order: number;
  show: boolean;
  configuration?: Record<string, unknown>;
  features?: Record<string, unknown>;
  input?: Record<string, unknown>;
}

export interface BuildNormalizedValidationDetailParams {
  validationId: string | null;
  processName: string;
  environmentName: string;
  templateName: string | null;
  requestSteps: Record<string, RequestStepEntry>;
  fallbackClient: { name?: string | null; mail?: string | null; phone?: string | null };
  createResponse: CreateValidationResponse | null;
  stepResponse: GetValidationStepResponse | null;
  dataResponse: GetValidationDataResponse | null;
  stepTimestamps?: Record<string, { startedAt: string | null; completedAt: string | null }>;
}

function stepLabel(key: string): string {
  return STEP_CATALOG.find((s) => s.key === key)?.label ?? key;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function extractOcrFromFiles(files: unknown): Record<string, unknown> {
  const ocr: Record<string, unknown> = {};
  if (!Array.isArray(files)) return ocr;
  for (const file of files) {
    const fields = asRecord((file as { fields?: unknown })?.fields);
    Object.assign(ocr, fields);
  }
  return ocr;
}

function extractAlerts(source: unknown, acc: unknown[]): void {
  if (Array.isArray(source)) {
    acc.push(...source);
  }
}

/** `steps.captureId.data.ocr` — confirmado con una respuesta real de FAD (getValidationStep):
 * un array de `{key, value}` (no un objeto), a veces con la misma llave repetida (variantes
 * "MRZ"/"Visual" del mismo campo) — se conserva la ÚLTIMA ocurrencia de cada llave, igual que
 * `extractOcrFromFiles` hace con `Object.assign`. No documentado en el PDF ni en la colección
 * Postman. */
function extractOcrFromStepArray(ocr: unknown): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  if (!Array.isArray(ocr)) return result;
  for (const entry of ocr) {
    const record = asRecord(entry);
    if (typeof record.key === "string") result[record.key] = record.value;
  }
  return result;
}

/** Una categoría "plana" de `data.alerts` (`textCrossChecks`, `mrzCheckDigit`, `dateChecks`):
 * array directo de `{type:{name,description?}, result:{name,description?}, sources?}`. */
function pushFlatDocumentChecks(acc: NormalizedDocumentCheck[], category: string, items: unknown, page: number | null): void {
  if (!Array.isArray(items)) return;
  for (const item of items) {
    const record = asRecord(item);
    const type = asRecord(record.type);
    const result = asRecord(record.result);
    if (typeof type.name !== "string") continue;
    acc.push({
      category,
      page,
      name: type.name,
      description: typeof type.description === "string" ? type.description : null,
      result: typeof result.name === "string" ? result.name : "UNKNOWN",
      resultDescription: typeof result.description === "string" ? result.description : null,
      sources: Array.isArray(record.sources) ? record.sources.filter((s): s is string => typeof s === "string") : null,
    });
  }
}

/** Forma real de Acuant (AssureID) para `steps.captureId.data.alerts` — confirmada con una
 * respuesta real de FAD (`features.provider: 2`), distinta y no documentada en el PDF ni en la
 * colección Postman: un array PLANO de tests (`{Name, Key, Information, Description,
 * Disposition, Result, Actions, Model, ...}`), sin agrupar por categoría ni por página — a
 * diferencia de la forma categorizada de otros proveedores. `Result` es numérico (1 = positivo
 * en todas las respuestas reales revisadas); se traduce a "OK" para reutilizar el mismo criterio
 * visual (ícono verde) que ya usa la forma categorizada, y se preserva el número tal cual como
 * string para cualquier otro valor — nunca se asume qué significa un código no observado. */
function pushAcuantDocumentChecks(acc: NormalizedDocumentCheck[], items: unknown): void {
  if (!Array.isArray(items)) return;
  for (const item of items) {
    const record = asRecord(item);
    const name = typeof record.Name === "string" ? record.Name : typeof record.Key === "string" ? record.Key : null;
    if (!name) continue;
    const result = record.Result;
    acc.push({
      category: "documentValidation",
      page: null,
      name,
      description: typeof record.Information === "string" ? record.Information : null,
      result: result === 1 ? "OK" : result !== undefined && result !== null ? String(result) : "UNKNOWN",
      resultDescription: typeof record.Disposition === "string" ? record.Disposition : null,
      sources: null,
    });
  }
}

/** `steps.captureId.data.alerts` — confirmado con respuestas reales de FAD (getValidationStep),
 * no documentado en el PDF ni en la colección Postman. Dos formas completamente distintas según
 * el proveedor: Acuant (`features.provider: 2`) devuelve un array plano de tests AssureID (ver
 * `pushAcuantDocumentChecks`); otros proveedores devuelven un objeto con 5 categorías en dos
 * formas: `textCrossChecks`/`mrzCheckDigit`/`dateChecks` son arrays planos de checks;
 * `authenticity`/`imageQuality` son arrays de `{page, checks:[...]}` (agrupados por lado del
 * documento: 1 = frente, 2 = reverso). Se traduce todo a una única lista plana
 * (`NormalizedDocumentCheck[]`) para que el reporte las agrupe por `category`+`page` sin tener
 * que conocer esta diferencia de forma. Nunca lanza: una forma inesperada simplemente no aporta
 * filas, no rompe el resto. */
function extractDocumentChecks(alertsRaw: unknown): NormalizedDocumentCheck[] {
  const checks: NormalizedDocumentCheck[] = [];
  if (Array.isArray(alertsRaw)) {
    pushAcuantDocumentChecks(checks, alertsRaw);
    return checks;
  }
  const alerts = asRecord(alertsRaw);
  pushFlatDocumentChecks(checks, "textCrossChecks", alerts.textCrossChecks, null);
  pushFlatDocumentChecks(checks, "mrzCheckDigit", alerts.mrzCheckDigit, null);
  pushFlatDocumentChecks(checks, "dateChecks", alerts.dateChecks, null);
  for (const category of ["authenticity", "imageQuality"] as const) {
    const groups = alerts[category];
    if (!Array.isArray(groups)) continue;
    for (const group of groups) {
      const groupRecord = asRecord(group);
      const page = typeof groupRecord.page === "number" ? groupRecord.page : null;
      pushFlatDocumentChecks(checks, category, groupRecord.checks, page);
    }
  }
  return checks;
}

/** Folios y respuestas de validación contra gobierno (Registraduría/RENAPO/CECOBAN/ENROLL) —
 * campos reales de `getValidationData.data`, confirmados con una respuesta real de FAD, no
 * documentados en el PDF ni en la colección Postman. Solo se incluyen los que FAD devuelve
 * poblados (nunca se fabrica un campo vacío). */
const GOVERNMENT_VALIDATION_KEYS = [
  "folio",
  "folioProceso",
  "folioCecoban",
  "respuestaRenapo",
  "respuestaCecoban",
  "respuestaEnroll",
  "dataValidationRenapo",
  "dataValidationSat",
  "dataValidationFimpeRPADto",
  "dataValidationFimpeLN",
  "dataValidationId",
  "idVsRegistraduriaSimilarity",
] as const;

function extractGovernmentValidation(dataBlock: Record<string, unknown>): Record<string, unknown> | null {
  const result: Record<string, unknown> = {};
  for (const key of GOVERNMENT_VALIDATION_KEYS) {
    const value = dataBlock[key];
    if (value !== null && value !== undefined) result[key] = value;
  }
  return Object.keys(result).length > 0 ? result : null;
}

/** Campos de `getValidationData.data.client` distintos de `nombre`/`clientId` (que ya se
 * muestran vía `client.name`) — apellidoPaterno, apellidoMaterno, curp, rfc, nacionalidad, etc.,
 * confirmados con una respuesta real de FAD. Se muestran junto a la validación contra gobierno,
 * donde el operador necesita verlos en claro para auditar el resultado. */
function extractClientDetails(dataClient: Record<string, unknown>): Record<string, unknown> | null {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(dataClient)) {
    if (key === "nombre" || key === "clientId") continue;
    if (value !== null && value !== undefined && value !== "") result[key] = value;
  }
  return Object.keys(result).length > 0 ? result : null;
}

/** Deriva el nombre completo a partir del OCR del documento (`captureId.data.ocr`), usando solo
 * las claves reales observadas en respuestas de FAD: un campo combinado (`Full Name` /
 * `Surname And Given Names`) cuando existe, o la combinación de nombre(s) + apellido cuando
 * vienen por separado (`Given Name`/`Given Names`/`First Name` + `Surname`). Nunca se inventa un
 * nombre: si no hay ninguna de estas claves con valor no vacío, devuelve `null`. */
function deriveOcrFullName(ocr: Record<string, unknown>): string | null {
  const direct = ocr["Full Name"] ?? ocr["Surname And Given Names"];
  if (typeof direct === "string" && direct.trim()) return direct.trim();

  const given = ocr["Given Name"] ?? ocr["Given Names"] ?? ocr["First Name"];
  const surname = ocr["Surname"];
  if (typeof given === "string" && given.trim() && typeof surname === "string" && surname.trim()) {
    return `${given.trim()} ${surname.trim()}`;
  }

  return null;
}

const EXTERNAL_VALIDATION_HINT = /^(accuant_|comparison_|validation_)/;

export function buildNormalizedValidationDetail(params: BuildNormalizedValidationDetailParams): NormalizedValidationDetail {
  const dataBlock = params.dataResponse?.data ?? null;
  const stepBlock = params.stepResponse?.data ?? null;
  const stepsFromApi = asRecord(stepBlock?.steps);
  // Defensivo: `requestSteps` viene de `requestPayload.steps` deserializado — nunca debería
  // faltar en una ejecución creada por el flujo normal, pero si llegara `undefined`/`null` (fila
  // corrupta, dato antiguo), no debe tumbar el endpoint de sincronización con un error de bajo
  // nivel (`Object.keys(undefined)`); se trata como "sin pasos de la solicitud" y se sigue
  // mostrando lo que sí venga de la API de FAD (`stepsFromApi`).
  const requestSteps = params.requestSteps ?? {};

  const stepKeys = new Set<string>([...Object.keys(requestSteps), ...Object.keys(stepsFromApi)]);
  const steps: NormalizedStep[] = [...stepKeys].map((key) => {
    const apiStep = asRecord(stepsFromApi[key]);
    const requestStep = requestSteps[key];
    const timestamps = params.stepTimestamps?.[key];
    const rawStatus = typeof apiStep.status === "string" ? apiStep.status : null;

    return {
      key,
      label: stepLabel(key),
      order: (typeof apiStep.order === "number" ? apiStep.order : undefined) ?? requestStep?.order ?? 0,
      show: (typeof apiStep.show === "boolean" ? apiStep.show : undefined) ?? requestStep?.show ?? true,
      status: rawStatus ? normalizeStepStatus(rawStatus) : "PENDING",
      rawStatus,
      configuration: asRecord(apiStep.configuration ?? requestStep?.configuration),
      features: asRecord(apiStep.features ?? requestStep?.features),
      data: apiStep.data ?? null,
      startedAt: timestamps?.startedAt ?? null,
      completedAt: timestamps?.completedAt ?? null,
      durationSeconds:
        timestamps?.startedAt && timestamps?.completedAt
          ? Math.max(
              0,
              Math.round(
                (new Date(timestamps.completedAt).getTime() - new Date(timestamps.startedAt).getTime()) / 1000,
              ),
            )
          : null,
    };
  });
  steps.sort((a, b) => a.order - b.order);

  const shownSteps = steps.filter((s) => s.show);
  const completedSteps = shownSteps.filter((s) => s.status === "COMPLETED").length;
  const progressPercent = shownSteps.length > 0 ? Math.round((completedSteps / shownSteps.length) * 100) : 0;

  const stepValidation = asRecord(stepBlock?.validation);
  const rawStatus =
    (typeof dataBlock?.status === "string" ? dataBlock.status : null) ??
    (typeof stepValidation.status === "string" ? stepValidation.status : null);
  const rawResult =
    (typeof dataBlock?.result === "string" ? dataBlock.result : null) ??
    (typeof dataBlock?.validationProcessResult === "string" ? dataBlock.validationProcessResult : null);

  const files: NormalizedFile[] = Array.isArray(dataBlock?.files)
    ? (dataBlock!.files as unknown[])
        .filter((f): f is Record<string, unknown> => Boolean(f && typeof f === "object"))
        .map((f) => ({
          fileName: typeof f.fileName === "string" ? f.fileName : "archivo",
          fileUrl: typeof f.fileUrl === "string" ? f.fileUrl : "",
          fields: asRecord(f.fields),
        }))
    : [];

  const captureIdStep = steps.find((s) => s.key === "captureId");
  const captureIdData = asRecord(captureIdStep?.data);
  const classification = Object.keys(asRecord(captureIdData.classification)).length
    ? asRecord(captureIdData.classification)
    : null;

  // `data.ocr` del paso captureId (array {key,value}) es la fuente principal; `dataResponse.
  // files[].fields` (cuando existe) se superpone porque suele traer datos más finos por imagen.
  const ocr = { ...extractOcrFromStepArray(captureIdData.ocr), ...extractOcrFromFiles(dataBlock?.files) };

  const documentChecks = extractDocumentChecks(captureIdData.alerts);

  const dataClient = asRecord(dataBlock?.client);
  const stepClient = asRecord(stepBlock?.client);
  // El nombre leído del documento (OCR) es más confiable que el que se envió al crear la
  // validación (a menudo un valor de prueba genérico como "PRUEBA" mientras se captura el
  // proceso) — se prioriza cuando está disponible; el nombre originalmente enviado nunca se
  // descarta, sigue accesible en `dataClient`/`stepClient` (steps/raw) para trazabilidad.
  const clientName =
    deriveOcrFullName(ocr) ??
    (typeof dataClient.nombre === "string" ? dataClient.nombre : null) ??
    (typeof stepClient.name === "string" ? stepClient.name : null) ??
    params.fallbackClient.name ??
    null;
  const clientEmail = (typeof stepClient.mail === "string" ? stepClient.mail : null) ?? params.fallbackClient.mail ?? null;
  const clientPhone = (typeof stepClient.phone === "string" ? stepClient.phone : null) ?? params.fallbackClient.phone ?? null;

  const alerts: unknown[] = [];
  const extraInfo = asRecord(dataBlock?.extraInfo);
  extractAlerts(extraInfo.alerts, alerts);

  const externalValidationsSource = { ...asRecord(dataBlock?.externalValidations), ...extraInfo };
  const externalValidations: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(externalValidationsSource)) {
    if (key === "alerts") continue;
    if (EXTERNAL_VALIDATION_HINT.test(key) || Object.keys(externalValidationsSource).length <= 20) {
      externalValidations[key] = value;
    }
  }

  const dataBlockRecord = asRecord(dataBlock);
  const governmentValidation = extractGovernmentValidation(dataBlockRecord);
  const naatCheckRaw = dataBlockRecord.naatCheck;
  const naatCheckResult =
    naatCheckRaw && typeof naatCheckRaw === "object" && Object.keys(asRecord(naatCheckRaw)).length > 0
      ? asRecord(naatCheckRaw)
      : null;
  // Si esta plantilla pidió NAAT-CHECK dentro del mismo paso (`configuration.idValidations.
  // naatCheck.enabled`, ver CaptureIdEditor) y el documento sí se llegó a leer (captureIdData con
  // contenido) pero el proveedor nunca devolvió `naatCheck` en la respuesta, se dispara una carrera
  // real observada: el proveedor puede mantener el paso "pendiente" indefinidamente esperando su
  // propia verificación interna. Nunca se fabrica un resultado de riesgo: se deja constancia
  // explícita de que esa verificación puntual no se pudo completar (mismo vocabulario "WAS_NOT_DONE"
  // que el resto del reporte), sin bloquear el resto de "Validación de ID".
  const idValidationsConfig = asRecord(asRecord(captureIdStep?.configuration).idValidations);
  const naatCheckRequested = asRecord(idValidationsConfig.naatCheck).enabled === true;
  if (naatCheckRequested && Object.keys(captureIdData).length > 0 && naatCheckResult === null) {
    documentChecks.push({
      category: "naatCheck",
      page: null,
      name: "risk_assessment",
      description: "Verificación de riesgo NAAT-CHECK solicitada como parte de esta validación.",
      result: "WAS_NOT_DONE",
      resultDescription:
        "El proveedor de biometría no devolvió un resultado de NAAT-CHECK. El documento sí se leyó correctamente; solo esta verificación puntual no se pudo completar.",
      sources: null,
    });
  }

  const clientDetails = extractClientDetails(dataClient);

  const latitude = dataBlock?.latitude != null ? String(dataBlock.latitude) : null;
  const longitude = dataBlock?.longitude != null ? String(dataBlock.longitude) : null;

  return {
    validationId: params.validationId,
    processName: params.processName,
    environmentName: params.environmentName,
    templateName: params.templateName,
    status: normalizeValidationStatus(rawStatus),
    rawStatus,
    result: normalizeResult(rawResult),
    rawResult,
    client: {
      name: clientName,
      nameMasked: maskName(clientName),
      email: clientEmail,
      emailMasked: maskEmail(clientEmail),
      phone: clientPhone,
    },
    clientDetails,
    steps,
    progressPercent,
    startedAt: parseFlexibleDate(dataBlock?.startDate ?? null).iso,
    completedAt: parseFlexibleDate(dataBlock?.endDate ?? null).iso,
    lastSyncedAt: new Date().toISOString(),
    comparisonPercentage: toNumber(dataBlock?.porcentCompare),
    ocr: Object.keys(ocr).length > 0 ? ocr : null,
    classification,
    files,
    device: dataBlock?.deviceInfo ? asRecord(dataBlock.deviceInfo) : null,
    network: dataBlock?.networkInfo ? asRecord(dataBlock.networkInfo) : null,
    location: latitude || longitude ? { latitude, longitude } : null,
    externalValidations,
    alerts,
    documentChecks,
    // El rechazo automático por concordancia documental (`documentCheckRejection`) depende de la
    // configuración de puntuación (una fila en BD) — esta función es pura y no accede a BD, así
    // que solo pone el valor neutro por defecto; `executions.service.ts` lo sobreescribe después
    // de calcular el puntaje con la configuración real.
    documentCheckRejection: null,
    governmentValidation,
    naatCheckResult,
    mediaAssets: extractMediaAssets(steps),
    raw: {
      createResponse: params.createResponse,
      stepResponse: params.stepResponse,
      dataResponse: params.dataResponse,
    },
  };
}

import type { NormalizedValidationDetail, NormalizedMediaAsset, NormalizedStep } from "@fad-console/shared-types";
import type { WebSdkAcuantResultInput, WebSdkFacetecResultInput } from "@fad-console/validation-schemas";
import { toDataUri } from "./image-util";

interface CheckResult {
  risk: string;
  key: string;
  result?: boolean;
}

interface CompareResult {
  confidence: number;
  qualityFace1: number;
  qualityFace2: number;
}

export interface WebSdkNormalizeInput {
  validationId: string;
  processName: string;
  environmentName: string;
  templateName: string | null;
  client: { name: string; mail: string; phone: string };
  acuant: WebSdkAcuantResultInput;
  facetec: WebSdkFacetecResultInput;
  check: CheckResult;
  compare: CompareResult;
  saveResult: Record<string, unknown>;
  startedAt: string;
  completedAt: string;
}

function maskName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((word) => (word.length <= 1 ? word : `${word[0]}${"*".repeat(Math.max(word.length - 1, 3))}`))
    .join(" ");
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  const visible = (local ?? "").slice(0, 1) || "*";
  return `${visible}${"*".repeat(Math.max((local ?? "").length - 1, 3))}@${domain ?? ""}`;
}

/** Construye el `data.json` (metadata) del .TAR de `saveValidationData`, alineado con
 * `ValidationInfoDto` del backend FAD (ver docs/Integration_saveValidationData_service.pdf §3.3.1
 * y el proyecto de referencia `fad-demo-v1/src/app/services/validation.service.ts`). */
export function buildMetadataJson(input: WebSdkNormalizeInput): Record<string, unknown> {
  const ocr = (input.acuant.ocr ?? {}) as Record<string, unknown>;
  const docFiles: string[] = [];
  if (input.acuant.frontImage) docFiles.push("ineAnverso.png");
  if (input.acuant.backImage) docFiles.push("ineReverso.png");

  return {
    validationId: input.validationId,
    startDate: input.startedAt,
    latitude: "0",
    longitude: "0",
    assisted: false,
    status: null,
    companyId: null,
    companyTransaccionId: null,
    consecutiveCompanyId: null,
    processId: null,
    processType: 0,
    actionTypes: [1],
    otherDocuments: [],
    kycResult: null,
    idSelfieSimilarity: input.compare.confidence,
    client: {
      apellidoMaterno: ocr.mothersSurname ?? null,
      apellidoPaterno: ocr.fathersSurname ?? null,
      clientId: ocr.personalNumber ?? ocr.documentNumber ?? input.client.name,
      curp: ocr.curp ?? null,
      estadoCivil: null,
      nacionalidad: ocr.issuingStateName ?? null,
      nombre: ocr.givenName ?? ocr.firstName ?? input.client.name,
      rfc: null,
      tipoCliente: null,
    },
    deviceInfo: {
      appVersion: "fad-console-websdk",
      deviceModel: "web",
      deviceName: "web",
      operatingSystem: "web",
      platform: "Web",
      serialNumber: "-",
    },
    documents: [
      {
        files: docFiles,
        cardType: "ine",
        curp: ocr.curp ?? null,
        nombre: ocr.givenName ?? ocr.firstName ?? input.client.name,
        apellidoPaterno: ocr.fathersSurname ?? null,
        apellidoMaterno: ocr.mothersSurname ?? null,
        ocr: ocr.documentNumber ?? null,
        data_VINationalityName: ocr.issuingStateName ?? null,
        data_VIExpirationDate: ocr.expirationDate ?? null,
        data_DocumentNumber: ocr.documentNumber ?? null,
      },
    ],
    networkInfo: { ipAddress: "0.0.0.0", macAddress: "", network: "wifi" },
    extraInfo: {
      naatcheck_risk: input.check.risk,
      naatcheck_key: input.check.key,
      facetec_sessionId: input.facetec.sessionId ?? "",
      facetec_status: input.facetec.status !== undefined ? String(input.facetec.status) : "",
      faceMatch_confidence: String(input.compare.confidence),
      faceMatch_qualityFace1: String(input.compare.qualityFace1),
      faceMatch_qualityFace2: String(input.compare.qualityFace2),
    },
  };
}

/** Construye el `NormalizedValidationDetail` de una ejecución Web SDK, la misma forma canónica
 * que usan las ejecuciones API-by-steps — así el detalle/reporte (`ReportView`, `OcrTable`,
 * `ImageGallery`) funciona sin cambios sin importar el modelo de integración. */
/** Campos del response de `saveValidationData` (ver PDF Integration_saveValidationData_service
 * y el ejemplo de respuesta exitosa) que representan validaciones externas de terceros
 * (RENAPO, SAT, FIMPE, INE, etc.). Solo se agregan a `externalValidations` cuando FAD realmente
 * los devuelve con un valor (nunca se fabrican) — ver docs/technical-analysis.md "no inventar
 * información". */
const SAVE_RESULT_EXTERNAL_VALIDATION_KEYS = [
  "dataValidationRenapo",
  "dataValidationFimpeRPA",
  "dataValidationSat",
  "dataValidationFimpeCurp",
  "dataValidationFimpeLN",
  "dataValidationIne",
  "minuciasResponse",
  "validationInfoCompare",
  "validationEnrollmentResult",
  "validationAuthenticationResult",
] as const;

export function buildWebSdkNormalizedDetail(input: WebSdkNormalizeInput): NormalizedValidationDetail {
  const riskAccepted = input.check.result === true || input.check.risk.toUpperCase() === "LOW";
  const mediaAssets: NormalizedMediaAsset[] = [];
  function addAsset(stepKey: string, label: string, dataUri: string | undefined) {
    if (!dataUri) return;
    mediaAssets.push({ id: `${stepKey}:${label}`, stepKey, label, mimeType: "image/jpeg", dataUrl: toDataUri(dataUri) });
  }
  addAsset("captureId", "documentFront", input.acuant.frontImage);
  addAsset("captureId", "documentBack", input.acuant.backImage);
  addAsset("captureId", "idPhoto", input.acuant.idPhoto);
  // Acuant puede devolver imágenes embebidas dentro de idData.ocr (foto/firma/huella); se
  // extraen aparte (ver fad-sdk-client.ts `splitOcrImages`) para que se muestren como imágenes,
  // nunca como texto en la tabla de OCR.
  addAsset("captureId", "ocrPhoto", input.acuant.ocrPhoto);
  addAsset("captureId", "ocrSignature", input.acuant.ocrSignature);
  addAsset("captureId", "ocrFingerprint", input.acuant.ocrFingerprint);
  // `originalPhoto` es propio de Regula (imagen original capturada antes de recorte/procesado —
  // ver "FAD SDK Web Regula" §Result); Acuant no lo devuelve, así que esto no agrega nada cuando
  // el motor de captura fue Acuant.
  addAsset("captureId", "originalPhoto", input.acuant.originalPhoto);
  addAsset("liveness", "selfie", input.facetec.selfie);
  if (input.facetec.auditTrail?.[0]) addAsset("liveness", "auditTrail", input.facetec.auditTrail[0]);

  const alerts: unknown[] = [];
  if (!riskAccepted) {
    alerts.push({ level: "warning", message: `NAAT-CHECK reportó riesgo ${input.check.risk} (${input.check.key})` });
  }
  // Alertas propias de Acuant (p. ej. manipulación de imagen, hologramas) — se dejan con sus
  // llaves originales (Name/Description/...): el renderizador de alertas del reporte ya detecta
  // esos nombres de campo de forma genérica, sea cual sea el proveedor.
  if (input.acuant.alerts?.length) alerts.push(...input.acuant.alerts);

  // Clasificación del documento (tipo, país emisor, etc.) + métricas de calidad de imagen por
  // lado (glare/dpi/sharpness/moire) — sin un lugar dedicado propio, se muestran junto a la
  // clasificación (misma tabla "Documento" del reporte) con prefijo para no chocar con los
  // nombres de campo que ya trae `classification`.
  const classification: Record<string, unknown> = { ...(input.acuant.classification ?? {}) };
  if (input.acuant.frontQuality) {
    for (const [k, v] of Object.entries(input.acuant.frontQuality)) classification[`front${k[0]!.toUpperCase()}${k.slice(1)}`] = v;
  }
  if (input.acuant.backQuality) {
    for (const [k, v] of Object.entries(input.acuant.backQuality)) classification[`back${k[0]!.toUpperCase()}${k.slice(1)}`] = v;
  }

  const externalValidations: Record<string, unknown> = {
    naat_check: { risk: input.check.risk, key: input.check.key, result: input.check.result ?? null },
    face_comparison: input.compare,
  };
  if (input.acuant.validation && Object.keys(input.acuant.validation).length > 0) {
    externalValidations.document_validation = input.acuant.validation;
  }
  // `regulaData`/`regulaResponse` (ver "FAD SDK Web Regula" §Result): se preservan tal cual los
  // devuelve el proveedor, sin interpretarlos — nunca se fabrica ni se descarta esta información
  // solo porque Acuant no tiene un equivalente.
  if (input.acuant.regulaData?.length) externalValidations.regula_data = input.acuant.regulaData;
  if (input.acuant.regulaResponse && Object.keys(input.acuant.regulaResponse).length > 0) {
    externalValidations.regula_response = input.acuant.regulaResponse;
  }
  for (const key of SAVE_RESULT_EXTERNAL_VALIDATION_KEYS) {
    const value = input.saveResult[key];
    if (value !== null && value !== undefined) externalValidations[key] = value;
  }

  const steps: NormalizedStep[] = [
    {
      key: "captureId",
      label: "Captura de documento (Acuant)",
      order: 1,
      show: true,
      status: "COMPLETED",
      rawStatus: "COMPLETED",
      configuration: {},
      features: {},
      data: { documentInstance: input.acuant.documentInstance ?? null },
      startedAt: input.startedAt,
      completedAt: input.startedAt,
      durationSeconds: null,
    },
    {
      key: "check",
      label: "NAAT-CHECK (evaluación de riesgo)",
      order: 2,
      show: true,
      status: "COMPLETED",
      rawStatus: "COMPLETED",
      configuration: {},
      features: {},
      data: { risk: input.check.risk, key: input.check.key, result: input.check.result ?? null },
      startedAt: input.startedAt,
      completedAt: input.startedAt,
      durationSeconds: null,
    },
    {
      key: "liveness",
      label: "Prueba de vida (Facetec)",
      order: 3,
      show: true,
      status: "COMPLETED",
      rawStatus: "COMPLETED",
      configuration: {},
      features: {},
      data: { sessionId: input.facetec.sessionId ?? null, status: input.facetec.status ?? null },
      startedAt: input.startedAt,
      completedAt: input.startedAt,
      durationSeconds: null,
    },
    {
      key: "compareFaces",
      label: "Comparación facial",
      order: 4,
      show: true,
      status: "COMPLETED",
      rawStatus: "COMPLETED",
      configuration: {},
      features: {},
      data: input.compare,
      startedAt: input.startedAt,
      completedAt: input.startedAt,
      durationSeconds: null,
    },
    {
      key: "saveValidationData",
      label: "Guardado de la validación",
      order: 5,
      show: true,
      status: "COMPLETED",
      rawStatus: "COMPLETED",
      configuration: {},
      features: {},
      data: input.saveResult,
      startedAt: input.completedAt,
      completedAt: input.completedAt,
      durationSeconds: null,
    },
  ];

  return {
    validationId: input.validationId,
    processName: input.processName,
    environmentName: input.environmentName,
    templateName: input.templateName,
    status: "COMPLETED",
    rawStatus: typeof input.saveResult.status === "string" ? input.saveResult.status : "TERMINADO",
    result: riskAccepted ? "APPROVED" : "REJECTED",
    rawResult: null,
    client: {
      name: null,
      nameMasked: maskName(input.client.name),
      email: null,
      emailMasked: maskEmail(input.client.mail),
      phone: null,
    },
    clientDetails: null,
    steps,
    progressPercent: 100,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    lastSyncedAt: input.completedAt,
    comparisonPercentage: input.compare.confidence,
    ocr: (input.acuant.ocr as Record<string, unknown> | undefined) ?? null,
    classification: Object.keys(classification).length > 0 ? classification : null,
    files: [],
    device: null,
    network: null,
    location: null,
    externalValidations,
    alerts,
    documentChecks: [],
    // El flujo Web SDK no produce `documentChecks` (captura Acuant/Regula/CaptureId + Facetec, no
    // el paso `captureId` de FAD por-pasos) — el rechazo automático por concordancia documental
    // nunca aplica aquí (ver `documentCheckRejection` en NormalizedValidationDetail).
    documentCheckRejection: null,
    governmentValidation: null,
    naatCheckResult: null,
    mediaAssets,
    raw: {
      createResponse: null,
      stepResponse: null,
      dataResponse: { check: input.check, compare: input.compare, saveValidationData: input.saveResult },
    },
  };
}

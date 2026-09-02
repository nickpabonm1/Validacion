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
  addAsset("liveness", "selfie", input.facetec.selfie);
  if (input.facetec.auditTrail?.[0]) addAsset("liveness", "auditTrail", input.facetec.auditTrail[0]);

  const alerts: unknown[] = [];
  if (!riskAccepted) {
    alerts.push({ level: "warning", message: `NAAT-CHECK reportó riesgo ${input.check.risk} (${input.check.key})` });
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
    steps,
    progressPercent: 100,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    lastSyncedAt: input.completedAt,
    comparisonPercentage: input.compare.confidence,
    ocr: (input.acuant.ocr as Record<string, unknown> | undefined) ?? null,
    classification: null,
    files: [],
    device: null,
    network: null,
    location: null,
    externalValidations: {
      naat_check: { risk: input.check.risk, key: input.check.key, result: input.check.result ?? null },
      face_comparison: input.compare,
    },
    alerts,
    mediaAssets,
    raw: {
      createResponse: null,
      stepResponse: null,
      dataResponse: { check: input.check, compare: input.compare, saveValidationData: input.saveResult },
    },
  };
}

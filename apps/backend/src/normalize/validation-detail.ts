import type { NormalizedFile, NormalizedStep, NormalizedValidationDetail } from "@fad-console/shared-types";
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

const EXTERNAL_VALIDATION_HINT = /^(accuant_|comparison_|validation_)/;

export function buildNormalizedValidationDetail(params: BuildNormalizedValidationDetailParams): NormalizedValidationDetail {
  const dataBlock = params.dataResponse?.data ?? null;
  const stepBlock = params.stepResponse?.data ?? null;
  const stepsFromApi = asRecord(stepBlock?.steps);

  const stepKeys = new Set<string>([...Object.keys(params.requestSteps), ...Object.keys(stepsFromApi)]);
  const steps: NormalizedStep[] = [...stepKeys].map((key) => {
    const apiStep = asRecord(stepsFromApi[key]);
    const requestStep = params.requestSteps[key];
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

  const dataClient = asRecord(dataBlock?.client);
  const stepClient = asRecord(stepBlock?.client);
  const clientName =
    (typeof dataClient.nombre === "string" ? dataClient.nombre : null) ??
    (typeof stepClient.name === "string" ? stepClient.name : null) ??
    params.fallbackClient.name ??
    null;
  const clientEmail = (typeof stepClient.mail === "string" ? stepClient.mail : null) ?? params.fallbackClient.mail ?? null;
  const clientPhone = (typeof stepClient.phone === "string" ? stepClient.phone : null) ?? params.fallbackClient.phone ?? null;

  const files: NormalizedFile[] = Array.isArray(dataBlock?.files)
    ? (dataBlock!.files as unknown[])
        .filter((f): f is Record<string, unknown> => Boolean(f && typeof f === "object"))
        .map((f) => ({
          fileName: typeof f.fileName === "string" ? f.fileName : "archivo",
          fileUrl: typeof f.fileUrl === "string" ? f.fileUrl : "",
          fields: asRecord(f.fields),
        }))
    : [];

  const ocr = extractOcrFromFiles(dataBlock?.files);
  const captureIdStep = steps.find((s) => s.key === "captureId");
  const captureIdData = asRecord(captureIdStep?.data);
  const classification = Object.keys(asRecord(captureIdData.classification)).length
    ? asRecord(captureIdData.classification)
    : null;

  const alerts: unknown[] = [];
  extractAlerts(asRecord(captureIdData.idData).alerts, alerts);
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
    mediaAssets: extractMediaAssets(steps),
    raw: {
      createResponse: params.createResponse,
      stepResponse: params.stepResponse,
      dataResponse: params.dataResponse,
    },
  };
}

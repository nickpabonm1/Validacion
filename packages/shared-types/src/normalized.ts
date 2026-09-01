import type { NormalizedResult, NormalizedStepStatus, NormalizedValidationStatus } from "./enums";

/**
 * Forma canónica normalizada de una validación, resultado de combinar
 * createValidation + getValidationStep + getValidationData a través de las funciones de
 * `normalize*` (ver docs/architecture.md §3). Esta es la estructura sobre la que operan el
 * Diseñador de vista de respuestas (rutas tipo `client.nameMasked`) y el detalle de ejecución.
 * Todos los campos "raw*" preservan el dato original sin transformar.
 */
export interface NormalizedStep {
  key: string;
  label: string;
  order: number;
  show: boolean;
  status: NormalizedStepStatus;
  rawStatus: string | null;
  configuration: Record<string, unknown>;
  features: Record<string, unknown>;
  data: unknown;
  startedAt: string | null;
  completedAt: string | null;
  durationSeconds: number | null;
}

export interface NormalizedFile {
  fileName: string;
  fileUrl: string;
  fields: Record<string, unknown>;
}

/**
 * Imagen embebida (base64) encontrada dentro de la respuesta de un paso (por ejemplo
 * `captureId.data.files[]`, `liveness.data.files[]`, huellas en formato jpeg, etc.). Se
 * extrae y normaliza a una `dataUrl` lista para renderizar, en vez de mostrarse como texto
 * base64 dentro de un volcado JSON (ver ExecutionDetailPage, pestaña "Reporte").
 */
export interface NormalizedMediaAsset {
  id: string;
  stepKey: string;
  label: string;
  mimeType: string;
  dataUrl: string;
}

export interface NormalizedValidationDetail {
  validationId: string | null;
  processName: string;
  environmentName: string;
  templateName: string | null;

  status: NormalizedValidationStatus;
  rawStatus: string | null;
  result: NormalizedResult;
  rawResult: string | null;

  client: {
    name: string | null;
    nameMasked: string;
    email: string | null;
    emailMasked: string;
    phone: string | null;
  };

  steps: NormalizedStep[];
  progressPercent: number;

  startedAt: string | null;
  completedAt: string | null;
  lastSyncedAt: string | null;

  comparisonPercentage: number | null;
  ocr: Record<string, unknown> | null;
  classification: Record<string, unknown> | null;
  files: NormalizedFile[];
  device: Record<string, unknown> | null;
  network: Record<string, unknown> | null;
  location: { latitude: string | null; longitude: string | null } | null;
  externalValidations: Record<string, unknown>;
  alerts: unknown[];
  mediaAssets: NormalizedMediaAsset[];

  raw: {
    createResponse: unknown | null;
    stepResponse: unknown | null;
    dataResponse: unknown | null;
  };
}

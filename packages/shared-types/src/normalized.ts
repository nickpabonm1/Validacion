import type { NormalizedResult, NormalizedStepStatus, NormalizedValidationStatus } from "./enums";
import type { NaatCheckRecheckResultDto } from "./naat-check";

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

/**
 * Una fila de "Validación de ID" / calidad de imagen / autenticidad / MRZ / fechas del paso
 * `captureId` (ver `getValidationStep`, `steps.captureId.data.alerts.{textCrossChecks,
 * authenticity,imageQuality,mrzCheckDigit,dateChecks}` — confirmado con una respuesta real de
 * FAD, no documentado en el PDF ni en la colección Postman). `category` agrupa las filas en las
 * mismas secciones que ya muestra el Portal FAD ("Validación de datos cruzados", "Autenticidad
 * del documento", "Calidad de la imagen", "Verificación de dígitos MRZ", "Validación de
 * fechas"); `page` distingue frente (1) / reverso (2) cuando la validación FAD lo reporta por
 * lado del documento (authenticity/imageQuality), null cuando no aplica.
 */
export interface NormalizedDocumentCheck {
  category: string;
  page: number | null;
  name: string;
  description: string | null;
  result: string;
  resultDescription: string | null;
  sources: string[] | null;
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
  /** Campos adicionales de `getValidationData.data.client` (apellidoPaterno, apellidoMaterno,
   * curp, rfc, nacionalidad, etc. — confirmados con una respuesta real de FAD), cuando FAD los
   * devuelve poblados. No se enmascaran (a diferencia de `client.name/email`) porque se muestran
   * junto a la comparación contra Registraduría/RENAPO, donde el operador necesita verlos en
   * claro para auditar el resultado. */
  clientDetails: Record<string, unknown> | null;

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
  /** Validación de ID del paso `captureId` (datos cruzados, autenticidad, calidad de imagen,
   * MRZ, fechas) — ver `NormalizedDocumentCheck`. Vacío cuando el paso `captureId` todavía no
   * tiene `data.alerts` (paso pendiente) o el proveedor no devolvió ese detalle. */
  documentChecks: NormalizedDocumentCheck[];
  /** Cuando la configuración de puntuación (`DocumentCheckScoringConfigDto.passThreshold`) está
   * activa y el porcentaje calculado de `documentChecks` (ver `computeDocumentCheckScore`) queda
   * por debajo de ese umbral, el sistema RECHAZA automáticamente el proceso por no concordancia
   * documental — `result` pasa a "REJECTED" (ver `executions.service.ts recomputeAndPersist`) y
   * este campo queda poblado con el porcentaje/umbral exactos para que el reporte explique el
   * motivo. `rawResult` conserva intacto el resultado que FAD haya devuelto, sin tocar — este
   * campo documenta que la decisión de `result` es de esta consola, no de FAD. `null` cuando no
   * aplicó (sin umbral configurado, o el porcentaje calculado sí lo alcanzó). */
  documentCheckRejection: { percentage: number; threshold: number } | null;
  /** Folios y respuestas de validación contra gobierno (Registraduría/RENAPO/CECOBAN/ENROLL —
   * `getValidationData.data.{folio,folioProceso,folioCecoban,respuestaRenapo,respuestaCecoban,
   * respuestaEnroll,dataValidationRenapo,dataValidationSat,dataValidationFimpeRPADto,
   * dataValidationFimpeLN,dataValidationId,idVsRegistraduriaSimilarity}` — confirmado con una
   * respuesta real de FAD, no documentado en el PDF ni en la colección Postman). `null` cuando
   * ninguno de estos campos viene poblado (validación aún no llegó a esa etapa, o el ambiente no
   * usa validación contra gobierno). */
  governmentValidation: Record<string, unknown> | null;
  /** `getValidationData.data.naatCheck` — resultado de NAAT-CHECK expuesto también en el detalle
   * completo de la validación (no solo en el paso `check`), con la forma que muestra el propio
   * Portal FAD ("NAAT Check": resultado/id/riesgo/clave/descripción de la clave). `null` cuando
   * FAD todavía no lo devuelve. */
  naatCheckResult: Record<string, unknown> | null;
  /** Resultado de un recheck NAAT-CHECK disparado MANUALMENTE sobre esta ejecución (botón
   * "Reevaluar con NAAT-CHECK", módulo `naat-check`) — distinto de `naatCheckResult` (arriba,
   * pasivo, lo devuelve FAD). También se refleja como una fila sintética en `documentChecks`
   * (categoría `naatCheckRecheck`) para que participe en la puntuación por categoría. `null` =
   * nunca se disparó un recheck sobre esta ejecución. */
  naatCheckRecheckResult: NaatCheckRecheckResultDto | null;
  mediaAssets: NormalizedMediaAsset[];

  raw: {
    createResponse: unknown | null;
    stepResponse: unknown | null;
    dataResponse: unknown | null;
  };
}

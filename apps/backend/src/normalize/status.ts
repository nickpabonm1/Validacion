import type { NormalizedResult, NormalizedStepStatus, NormalizedValidationStatus } from "@fad-console/shared-types";

/**
 * Normaliza el estado general de una validación. Fuente de valores observados/documentados:
 * `EN_PROCESO`, `PENDING`, `COMPLETED` (getValidationStep) y `TERMINADO` (getValidationData,
 * también documentado como `Completed/Pending/In progress`). Ver docs/api-contracts.md e
 * inconsistencia #5 en docs/technical-analysis.md: nunca se asume que estos son los únicos
 * valores posibles — cualquier valor no reconocido cae en UNKNOWN sin perder `rawStatus`.
 */
export function normalizeValidationStatus(raw: string | null | undefined): NormalizedValidationStatus {
  if (!raw) return "UNKNOWN";
  const value = raw.trim().toUpperCase();
  switch (value) {
    case "EN_PROCESO":
    case "IN_PROGRESS":
    case "IN PROGRESS":
    case "PROCESANDO":
      return "IN_PROGRESS";
    case "PENDING":
    case "PENDIENTE":
      return "CREATED";
    case "COMPLETED":
    case "COMPLETADO":
    case "TERMINADO":
    case "FINISHED":
      return "COMPLETED";
    case "EXPIRED":
    case "EXPIRADO":
    case "VENCIDO":
      return "EXPIRED";
    case "CANCELLED":
    case "CANCELED":
    case "CANCELADO":
      return "CANCELLED";
    case "FAILED":
    case "ERROR":
    case "FALLIDO":
      return "FAILED";
    default:
      return "UNKNOWN";
  }
}

export function normalizeStepStatus(raw: string | null | undefined): NormalizedStepStatus {
  if (!raw) return "UNKNOWN";
  const value = raw.trim().toUpperCase();
  switch (value) {
    case "PENDING":
    case "PENDIENTE":
      return "PENDING";
    case "EN_PROCESO":
    case "IN_PROGRESS":
      return "IN_PROGRESS";
    case "COMPLETED":
    case "COMPLETADO":
    case "TERMINADO":
      return "COMPLETED";
    case "FAILED":
    case "ERROR":
    case "FALLIDO":
      return "FAILED";
    case "SKIPPED":
    case "OMITIDO":
      return "SKIPPED";
    default:
      return "UNKNOWN";
  }
}

export function normalizeResult(raw: string | null | undefined): NormalizedResult {
  if (!raw) return "UNKNOWN";
  const value = raw.trim().toUpperCase();
  if (["APROBADO", "APPROVED", "VÁLIDO", "VALIDO", "VALID"].includes(value)) return "APPROVED";
  if (["RECHAZADO", "REJECTED", "INVÁLIDO", "INVALIDO", "INVALID"].includes(value)) return "REJECTED";
  return "UNKNOWN";
}

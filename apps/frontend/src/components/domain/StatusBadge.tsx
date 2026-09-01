import { Badge, type BadgeTone } from "../ui/badge";

const STATUS_LABELS: Record<string, string> = {
  CREATED: "Creada",
  IN_PROGRESS: "En proceso",
  COMPLETED: "Completada",
  FAILED: "Fallida",
  EXPIRED: "Expirada",
  CANCELLED: "Cancelada",
  UNKNOWN: "Desconocido",
};

const STATUS_TONES: Record<string, BadgeTone> = {
  CREATED: "info",
  IN_PROGRESS: "warning",
  COMPLETED: "success",
  FAILED: "error",
  EXPIRED: "neutral",
  CANCELLED: "neutral",
  UNKNOWN: "neutral",
};

export function StatusBadge({ status }: { status: string | null | undefined }) {
  const key = status ?? "UNKNOWN";
  return <Badge tone={STATUS_TONES[key] ?? "neutral"}>{STATUS_LABELS[key] ?? key}</Badge>;
}

const RESULT_LABELS: Record<string, string> = {
  APPROVED: "Aprobado",
  REJECTED: "Rechazado",
  UNKNOWN: "Sin resultado",
};
const RESULT_TONES: Record<string, BadgeTone> = {
  APPROVED: "success",
  REJECTED: "error",
  UNKNOWN: "neutral",
};

export function ResultBadge({ result }: { result: string | null | undefined }) {
  const key = result ?? "UNKNOWN";
  return <Badge tone={RESULT_TONES[key] ?? "neutral"}>{RESULT_LABELS[key] ?? key}</Badge>;
}

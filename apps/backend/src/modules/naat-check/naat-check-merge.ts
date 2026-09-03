import type { NaatCheckRecheckResultDto, NormalizedValidationDetail, RiskLevel } from "@fad-console/shared-types";
import { fromJsonField } from "../../lib/json-field";

const RISK_ORDER: Record<RiskLevel, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 };

/**
 * Aplica el resultado guardado de un recheck NAAT-CHECK manual (ver `naat-check.service.ts`) al
 * detalle normalizado — puro (no accede a BD), llamado desde `executions.service.ts
 * recomputeAndPersist` en CADA sincronización para que el check sintético sobreviva a un
 * re-cálculo (que de otro modo solo deriva de las respuestas crudas de FAD, sin lugar para este
 * resultado). Agrega una fila sintética a `documentChecks` (categoría `naatCheckRecheck`) para
 * que participe en la puntuación por categoría — "OK" cuando el riesgo está dentro del nivel
 * aceptado configurado, o `RISK_<nivel>` (tratado como advertencia por `resultTone`) cuando lo
 * supera.
 */
export function applyNaatCheckRecheckToDetail(
  detail: NormalizedValidationDetail,
  storedResultJson: string | null,
  acceptedRiskLevel: RiskLevel,
): void {
  const stored = fromJsonField<NaatCheckRecheckResultDto | null>(storedResultJson, null);
  detail.naatCheckRecheckResult = stored;
  if (!stored) return;

  const withinAcceptedRisk = RISK_ORDER[stored.risk] <= RISK_ORDER[acceptedRiskLevel];
  detail.documentChecks.push({
    category: "naatCheckRecheck",
    page: null,
    name: "risk_assessment",
    description: "Reevaluación de riesgo NAAT-CHECK (bajo pedido, fuera del flujo principal)",
    result: withinAcceptedRisk ? "OK" : `RISK_${stored.risk}`,
    resultDescription: stored.key ? `Riesgo ${stored.risk} — ${stored.key}` : `Riesgo ${stored.risk}`,
    sources: ["naat-check-recheck"],
  });
}

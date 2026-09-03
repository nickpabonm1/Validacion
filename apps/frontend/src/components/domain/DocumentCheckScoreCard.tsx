import { Settings2 } from "lucide-react";
import { Link } from "react-router-dom";
import { computeDocumentCheckScore, type NormalizedDocumentCheck } from "@fad-console/shared-types";
import { useAuth } from "../../lib/auth-context";
import { useDocumentCheckScoringConfig } from "../../features/document-check-scoring/useDocumentCheckScoring";
import { Badge, type BadgeTone } from "../ui/badge";
import { CATEGORY_LABELS } from "./DocumentChecksReport";

function scoreTone(passed: boolean | null): BadgeTone {
  if (passed === true) return "success";
  if (passed === false) return "error";
  return "neutral";
}

function ScoreBar({ label, percentage }: { label: string; percentage: number | null }) {
  return (
    <div className="flex items-center gap-2">
      <p className="w-40 shrink-0 truncate text-xs text-muted-foreground">{label}</p>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${percentage ?? 0}%` }}
        />
      </div>
      <p className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
        {percentage === null ? "—" : `${percentage}%`}
      </p>
    </div>
  );
}

/**
 * Tarjeta de puntuación de "Validación de ID": porcentaje total ponderado por categoría (según la
 * configuración de `document-check-scoring`, editable en el menú "Configuración de la respuesta")
 * con desglose por categoría y un veredicto opcional (aprobado/rechazado) cuando hay un umbral
 * configurado. Los checks "WAS_NOT_DONE" nunca se cuentan como acierto ni como fallo (ver
 * `computeDocumentCheckScore`). Cuando hay umbral, "Rechazado automáticamente" refleja lo que el
 * backend ya aplicó de verdad al `result` de la ejecución (ver `documentCheckRejection`), no solo
 * un aviso visual — este cálculo en el frontend usa la misma función y la misma configuración, así
 * que coincide con lo que el backend decidió al sincronizar.
 */
export function DocumentCheckScoreCard({ checks }: { checks: NormalizedDocumentCheck[] }) {
  const { user } = useAuth();
  const { data: config } = useDocumentCheckScoringConfig();

  if (!config) return null;

  const score = computeDocumentCheckScore(checks, config.categoryWeights, config.passThreshold, config.treatNotDoneAsFailure);

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <p className="text-3xl font-bold tabular-nums">{score.percentage === null ? "—" : `${score.percentage}%`}</p>
          <div>
            <Badge tone={scoreTone(score.passed)}>
              {score.passed === true ? "Aprobado" : score.passed === false ? "Rechazado automáticamente" : "Puntaje de validación"}
            </Badge>
            <p className="mt-1 text-xs text-muted-foreground">
              {score.achievedWeight} de {score.totalWeight} ponderado correcto
              {score.skippedCount > 0 ? ` · ${score.skippedCount} no evaluado${score.skippedCount === 1 ? "" : "s"}` : ""}
            </p>
          </div>
        </div>
        {user?.role === "ADMIN" ? (
          <Link
            to="/response-scoring"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            title="Configurar prioridad de calificación y umbral de rechazo"
          >
            <Settings2 className="h-3.5 w-3.5" /> Configurar
          </Link>
        ) : null}
      </div>
      {score.byCategory.length > 0 ? (
        <div className="mt-3 space-y-1.5 border-t border-border pt-3">
          {score.byCategory.map((c) => (
            <ScoreBar key={c.category} label={CATEGORY_LABELS[c.category] ?? c.category} percentage={c.percentage} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

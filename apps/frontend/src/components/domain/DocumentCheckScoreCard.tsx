import { useEffect, useState } from "react";
import { Settings2 } from "lucide-react";
import type { NormalizedDocumentCheck } from "@fad-console/shared-types";
import { useAuth } from "../../lib/auth-context";
import { computeDocumentCheckScore } from "../../lib/document-check-score";
import {
  useDocumentCheckScoringConfig,
  useUpdateDocumentCheckScoringConfig,
} from "../../features/document-check-scoring/useDocumentCheckScoring";
import { Badge, type BadgeTone } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog";
import { CATEGORY_LABELS } from "./DocumentChecksReport";
import { useToast } from "../ui/toast";

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

/** Diálogo de configuración (solo ADMIN): peso por categoría y umbral de aprobación. Ambos son
 * una decisión de negocio del operador — nunca algo que este sistema decida por su cuenta — así
 * que se guardan tal cual el administrador los defina, sin valores sugeridos que insinúen una
 * importancia relativa que FAD no confirma. */
function ScoringConfigDialog({
  open,
  onOpenChange,
  categories,
  categoryWeights,
  passThreshold,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: string[];
  categoryWeights: Record<string, number>;
  passThreshold: number | null;
}) {
  const { notify } = useToast();
  const updateConfig = useUpdateDocumentCheckScoringConfig();
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [threshold, setThreshold] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    setWeights(Object.fromEntries(categories.map((c) => [c, String(categoryWeights[c] ?? 1)])));
    setThreshold(passThreshold === null ? "" : String(passThreshold));
  }, [open, categories, categoryWeights, passThreshold]);

  async function handleSave() {
    const parsedWeights: Record<string, number> = {};
    for (const category of categories) {
      const raw = weights[category];
      const value = raw === undefined || raw === "" ? 1 : Number(raw);
      parsedWeights[category] = Number.isFinite(value) && value >= 0 ? value : 1;
    }
    const parsedThreshold = threshold.trim() === "" ? null : Number(threshold);
    try {
      await updateConfig.mutateAsync({
        categoryWeights: parsedWeights,
        passThreshold: parsedThreshold !== null && Number.isFinite(parsedThreshold) ? parsedThreshold : null,
      });
      notify({ title: "Configuración de puntuación guardada", tone: "success" });
      onOpenChange(false);
    } catch (error) {
      notify({ title: "Error al guardar", description: (error as Error).message, tone: "error" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Configurar puntuación de validación de documento</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Define qué tan importante es cada categoría (peso) para calcular el porcentaje total, y desde qué
            porcentaje se considera aprobada. Una categoría sin peso definido cuenta como 1 (peso neutro).
          </p>
          <div className="space-y-2">
            {categories.map((category) => (
              <div key={category} className="flex items-center justify-between gap-3">
                <Label htmlFor={`weight-${category}`} className="text-xs">
                  {CATEGORY_LABELS[category] ?? category}
                </Label>
                <Input
                  id={`weight-${category}`}
                  type="number"
                  min={0}
                  step="0.5"
                  className="h-8 w-24 text-right"
                  value={weights[category] ?? "1"}
                  onChange={(e) => setWeights((prev) => ({ ...prev, [category]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
            <Label htmlFor="pass-threshold" className="text-xs">
              Umbral de aprobación (%) — vacío = sin veredicto, solo se muestra el porcentaje
            </Label>
            <Input
              id="pass-threshold"
              type="number"
              min={0}
              max={100}
              className="h-8 w-24 text-right"
              placeholder="Sin umbral"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={updateConfig.isPending}>
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Tarjeta de puntuación de "Validación de ID": porcentaje total ponderado por categoría (según la
 * configuración de `document-check-scoring`, editable por un ADMIN) con desglose por categoría y
 * un veredicto opcional (aprobado/revisar) cuando hay un umbral configurado. Los checks
 * "WAS_NOT_DONE" nunca se cuentan como acierto ni como fallo (ver `computeDocumentCheckScore`).
 */
export function DocumentCheckScoreCard({ checks }: { checks: NormalizedDocumentCheck[] }) {
  const { user } = useAuth();
  const { data: config } = useDocumentCheckScoringConfig();
  const [configOpen, setConfigOpen] = useState(false);

  if (!config) return null;

  const score = computeDocumentCheckScore(checks, config.categoryWeights, config.passThreshold);
  const categories = [...new Set(checks.map((c) => c.category))];

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <p className="text-3xl font-bold tabular-nums">{score.percentage === null ? "—" : `${score.percentage}%`}</p>
          <div>
            <Badge tone={scoreTone(score.passed)}>
              {score.passed === true ? "Aprobado" : score.passed === false ? "Requiere revisión" : "Puntaje de validación"}
            </Badge>
            <p className="mt-1 text-xs text-muted-foreground">
              {score.achievedWeight} de {score.totalWeight} ponderado correcto
              {score.skippedCount > 0 ? ` · ${score.skippedCount} no evaluado${score.skippedCount === 1 ? "" : "s"}` : ""}
            </p>
          </div>
        </div>
        {user?.role === "ADMIN" ? (
          <Button variant="ghost" size="icon" aria-label="Configurar puntuación" onClick={() => setConfigOpen(true)}>
            <Settings2 className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
      {score.byCategory.length > 0 ? (
        <div className="mt-3 space-y-1.5 border-t border-border pt-3">
          {score.byCategory.map((c) => (
            <ScoreBar key={c.category} label={CATEGORY_LABELS[c.category] ?? c.category} percentage={c.percentage} />
          ))}
        </div>
      ) : null}
      {user?.role === "ADMIN" ? (
        <ScoringConfigDialog
          open={configOpen}
          onOpenChange={setConfigOpen}
          categories={categories}
          categoryWeights={config.categoryWeights}
          passThreshold={config.passThreshold}
        />
      ) : null}
    </div>
  );
}

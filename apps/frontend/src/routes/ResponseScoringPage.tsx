import { useEffect, useState } from "react";
import {
  useDocumentCheckScoringConfig,
  useUpdateDocumentCheckScoringConfig,
} from "../features/document-check-scoring/useDocumentCheckScoring";
import { PageHeader, Skeleton } from "../components/ui/misc";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Field, InlineSwitchField } from "../builder/editors/Field";
import { CATEGORY_LABELS } from "../components/domain/DocumentChecksReport";
import { useToast } from "../components/ui/toast";

const DEFAULT_REJECTION_THRESHOLD = 70;

/**
 * Configuración de negocio de cómo se califica el resultado de la "Validación de ID" (paso
 * `captureId`): qué tan importante (prioridad/peso) es cada categoría de check para el porcentaje
 * total, y desde qué porcentaje el sistema RECHAZA automáticamente el proceso por no concordancia
 * documental (ver `documentCheckRejection` en el detalle de la ejecución y `executions.service.ts`
 * — el rechazo se aplica cada vez que se sincroniza el estado, no solo al mostrar el reporte).
 * Antes esta configuración solo era editable desde un ícono dentro del reporte de cada ejecución;
 * ahora vive en una sola pantalla, en el menú, para que sea fácil de encontrar y auditar.
 */
export function ResponseScoringPage() {
  const { data: config, isLoading } = useDocumentCheckScoringConfig();
  const updateConfig = useUpdateDocumentCheckScoringConfig();
  const { notify } = useToast();

  const categories = Object.keys(CATEGORY_LABELS);
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [rejectionEnabled, setRejectionEnabled] = useState(false);
  const [threshold, setThreshold] = useState<string>(String(DEFAULT_REJECTION_THRESHOLD));
  const [treatNotDoneAsFailure, setTreatNotDoneAsFailure] = useState(false);

  useEffect(() => {
    if (!config) return;
    setWeights(Object.fromEntries(categories.map((c) => [c, String(config.categoryWeights[c] ?? 1)])));
    setRejectionEnabled(config.passThreshold !== null);
    setThreshold(config.passThreshold === null ? String(DEFAULT_REJECTION_THRESHOLD) : String(config.passThreshold));
    setTreatNotDoneAsFailure(config.treatNotDoneAsFailure);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  async function handleSave() {
    const parsedWeights: Record<string, number> = {};
    for (const category of categories) {
      const raw = weights[category];
      const value = raw === undefined || raw === "" ? 1 : Number(raw);
      parsedWeights[category] = Number.isFinite(value) && value >= 0 ? value : 1;
    }
    const parsedThreshold = Number(threshold);
    const passThreshold = rejectionEnabled && Number.isFinite(parsedThreshold) ? Math.min(100, Math.max(0, parsedThreshold)) : null;

    try {
      await updateConfig.mutateAsync({ categoryWeights: parsedWeights, passThreshold, treatNotDoneAsFailure });
      notify({ title: "Configuración de la respuesta guardada", tone: "success" });
    } catch (error) {
      notify({ title: "Error al guardar", description: (error as Error).message, tone: "error" });
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        title="Configuración de la respuesta"
        description="Define la prioridad de cada categoría de la Validación de ID y desde qué porcentaje de concordancia documental el sistema rechaza el proceso automáticamente."
      />

      {isLoading || !config ? (
        <Skeleton className="h-64" />
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Prioridad de calificación por categoría</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Cada categoría de la Validación de ID pesa según el número que le asignes al calcular el porcentaje
                total (mayor número = más prioridad). Una categoría con peso 1 cuenta igual que cualquier otra
                (ponderación neutra, es decir, cuenta simple de aciertos).
              </p>
              <div className="space-y-2">
                {categories.map((category) => (
                  <div key={category} className="flex items-center justify-between gap-3">
                    <label htmlFor={`weight-${category}`} className="text-sm">
                      {CATEGORY_LABELS[category]}
                    </label>
                    <Input
                      id={`weight-${category}`}
                      type="number"
                      min={0}
                      step="0.5"
                      className="h-9 w-24 text-right"
                      value={weights[category] ?? "1"}
                      onChange={(e) => setWeights((prev) => ({ ...prev, [category]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
              <InlineSwitchField
                label="Tratar «Verificación no realizada» como fallo"
                checked={treatNotDoneAsFailure}
                onChange={setTreatNotDoneAsFailure}
                hint="Cuando el proveedor no ejecuta un check (aparece como «La verificación NO se realizó»), por defecto no cuenta ni a favor ni en contra del porcentaje. Actívalo para que reste al porcentaje, igual que un check fallido — útil si un check no ejecutado también debe considerarse falta de concordancia documental."
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Rechazo automático por no concordancia documental</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <InlineSwitchField
                label="Activar rechazo automático"
                checked={rejectionEnabled}
                onChange={setRejectionEnabled}
                hint="Cuando está activo, cada vez que se consulta el estado de una validación el sistema calcula el porcentaje de concordancia documental de la Validación de ID y, si queda por debajo del umbral, marca el proceso como Rechazado (por no concordancia documental) — sin importar el resultado que haya devuelto FAD."
              />
              {rejectionEnabled ? (
                <Field
                  label="Umbral mínimo de concordancia (%)"
                  htmlFor="pass-threshold"
                  hint="Por ejemplo, 70 significa: si la Validación de ID no alcanza al menos 70% de concordancia, el proceso se rechaza automáticamente."
                >
                  <Input
                    id="pass-threshold"
                    type="number"
                    min={0}
                    max={100}
                    className="w-32"
                    value={threshold}
                    onChange={(e) => setThreshold(e.target.value)}
                  />
                </Field>
              ) : null}
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={updateConfig.isPending}>
              Guardar
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import {
  useDocumentCheckScoringConfig,
  useKnownDocumentCheckFeatures,
  useUpdateDocumentCheckScoringConfig,
} from "../features/document-check-scoring/useDocumentCheckScoring";
import { PageHeader, Skeleton } from "../components/ui/misc";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Field, InlineSwitchField } from "../builder/editors/Field";
import { Badge } from "../components/ui/badge";
import { CATEGORY_LABELS } from "../components/domain/DocumentChecksReport";
import { useToast } from "../components/ui/toast";

const DEFAULT_REJECTION_THRESHOLD = 70;
const WEIGHT_SUM_TOLERANCE = 0.5;

interface FeatureRow {
  name: string;
  weight: string;
}

/** Reparte 100 proporcionalmente a `raw` (o en partes iguales si todo es 0), redondeando a enteros
 * de forma que la suma dé exactamente 100 (los mayores restos de redondeo reciben el punto extra).
 * Solo se usa para proponer un punto de partida válido al cargar la página — el operador puede
 * ajustar libremente después. */
function normalizeToHundred(keys: string[], raw: number[]): Record<string, number> {
  if (keys.length === 0) return {};
  const total = raw.reduce((sum, v) => sum + v, 0);
  const scaled = total > 0 ? raw.map((v) => (v / total) * 100) : keys.map(() => 100 / keys.length);
  const floors = scaled.map(Math.floor);
  const remainder = 100 - floors.reduce((sum, v) => sum + v, 0);
  const order = scaled
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  const result = [...floors];
  for (let k = 0; k < remainder && k < order.length; k++) {
    const targetIndex = order[k]!.i;
    result[targetIndex] = (result[targetIndex] ?? 0) + 1;
  }
  return Object.fromEntries(keys.map((k, i) => [k, result[i]!]));
}

function sumTone(total: number): "success" | "warning" {
  return Math.abs(total - 100) <= WEIGHT_SUM_TOLERANCE ? "success" : "warning";
}

function SumBadge({ total, emptyHint }: { total: number; emptyHint?: string }) {
  if (total === 0 && emptyHint) {
    return <span className="text-xs text-muted-foreground">{emptyHint}</span>;
  }
  const tone = sumTone(total);
  const rounded = Math.round(total * 10) / 10;
  return (
    <Badge tone={tone}>
      {tone === "success" ? `Suma: ${rounded}% ✓` : rounded > 100 ? `Suma: ${rounded}% — excede el 100%` : `Suma: ${rounded}% — faltan ${Math.round((100 - rounded) * 10) / 10}%`}
    </Badge>
  );
}

/**
 * Configuración de negocio de cómo se califica el resultado de la "Validación de ID" (paso
 * `captureId`): qué tan importante (prioridad/peso, 1-100%) es cada categoría de check, y dentro de
 * cada categoría, qué tan importante es cada característica individual (subpeso, también 1-100%)
 * — la calificación final de un check compuesto = peso de su categoría × subpeso de su
 * característica (ver `computeDocumentCheckScore` en shared-types). También define desde qué
 * porcentaje el sistema RECHAZA automáticamente el proceso por no concordancia documental (ver
 * `documentCheckRejection` en el detalle de la ejecución y `executions.service.ts` — el rechazo se
 * aplica cada vez que se sincroniza el estado, no solo al mostrar el reporte).
 */
export function ResponseScoringPage() {
  const { data: config, isLoading } = useDocumentCheckScoringConfig();
  const { data: knownFeatures } = useKnownDocumentCheckFeatures();
  const updateConfig = useUpdateDocumentCheckScoringConfig();
  const { notify } = useToast();

  const categories = Object.keys(CATEGORY_LABELS);
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [weights, setWeights] = useState<Record<string, string>>({});
  const [featureRows, setFeatureRows] = useState<Record<string, FeatureRow[]>>({});
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [rejectionEnabled, setRejectionEnabled] = useState(false);
  const [threshold, setThreshold] = useState<string>(String(DEFAULT_REJECTION_THRESHOLD));
  const [treatNotDoneAsFailure, setTreatNotDoneAsFailure] = useState(false);

  useEffect(() => {
    if (!config) return;
    const nextEnabled: Record<string, boolean> = {};
    for (const category of categories) {
      const w = config.categoryWeights[category];
      nextEnabled[category] = w === undefined || w > 0;
    }
    const enabledCategories = categories.filter((c) => nextEnabled[c]);
    const rawWeights = enabledCategories.map((c) => config.categoryWeights[c] ?? 1);
    const normalized = normalizeToHundred(enabledCategories, rawWeights);
    const nextWeights: Record<string, string> = Object.fromEntries(
      categories.map((c) => [c, String(nextEnabled[c] ? (normalized[c] ?? 0) : 0)]),
    );

    setEnabled(nextEnabled);
    setWeights(nextWeights);
    setFeatureRows(
      Object.fromEntries(
        categories.map((c) => [
          c,
          Object.entries(config.featureWeights[c] ?? {}).map(([name, weight]) => ({ name, weight: String(weight) })),
        ]),
      ),
    );
    setRejectionEnabled(config.passThreshold !== null);
    setThreshold(config.passThreshold === null ? String(DEFAULT_REJECTION_THRESHOLD) : String(config.passThreshold));
    setTreatNotDoneAsFailure(config.treatNotDoneAsFailure);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  const categoryTotal = categories.filter((c) => enabled[c]).reduce((sum, c) => sum + (Number(weights[c]) || 0), 0);
  const categoryTotalValid = categories.some((c) => enabled[c]) ? Math.abs(categoryTotal - 100) <= WEIGHT_SUM_TOLERANCE : true;

  const featureTotalsByCategory = Object.fromEntries(
    categories.map((c) => [c, (featureRows[c] ?? []).reduce((sum, row) => sum + (Number(row.weight) || 0), 0)]),
  );
  const featureTotalsValid = categories.every((c) => {
    const rows = featureRows[c] ?? [];
    if (rows.length === 0) return true;
    return Math.abs(featureTotalsByCategory[c]! - 100) <= WEIGHT_SUM_TOLERANCE;
  });

  const canSave = categoryTotalValid && featureTotalsValid;

  async function handleSave() {
    const categoryWeights: Record<string, number> = {};
    for (const category of categories) {
      categoryWeights[category] = enabled[category] ? Number(weights[category]) || 0 : 0;
    }

    const featureWeights: Record<string, Record<string, number>> = {};
    for (const category of categories) {
      const rows = (featureRows[category] ?? []).filter((r) => r.name.trim().length > 0);
      if (rows.length === 0) continue;
      featureWeights[category] = Object.fromEntries(rows.map((r) => [r.name.trim(), Number(r.weight) || 0]));
    }

    const parsedThreshold = Number(threshold);
    const passThreshold = rejectionEnabled && Number.isFinite(parsedThreshold) ? Math.min(100, Math.max(0, parsedThreshold)) : null;

    try {
      await updateConfig.mutateAsync({ categoryWeights, featureWeights, passThreshold, treatNotDoneAsFailure });
      notify({ title: "Configuración de la respuesta guardada", tone: "success" });
    } catch (error) {
      notify({ title: "Error al guardar", description: (error as Error).message, tone: "error" });
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Configuración de la respuesta"
        description="Define la prioridad de cada categoría de la Validación de ID, el subpeso de cada característica dentro de su categoría, y desde qué porcentaje de concordancia documental el sistema rechaza el proceso automáticamente."
      />

      {isLoading || !config ? (
        <Skeleton className="h-64" />
      ) : (
        <>
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>Prioridad de calificación por categoría</CardTitle>
              <SumBadge total={categoryTotal} />
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Cada categoría activa pesa un porcentaje (1-100%) de la calificación final; los pesos de las
                categorías activas deben sumar 100%. Desmarca una categoría para excluirla por completo del
                cálculo. Dentro de cada categoría puedes además repartir su peso entre sus características
                individuales («Subpesos») — si no configuras ninguno, cada característica de esa categoría pesa
                el 100% del peso de su categoría (comportamiento por defecto).
              </p>
              <div className="divide-y divide-border rounded-md border border-border">
                {categories.map((category) => {
                  const rows = featureRows[category] ?? [];
                  const isExpanded = expandedCategory === category;
                  const suggestions = knownFeatures?.[category] ?? [];
                  return (
                    <div key={category} className="p-3">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={enabled[category] ?? true}
                          onChange={(e) => setEnabled((prev) => ({ ...prev, [category]: e.target.checked }))}
                          className="h-4 w-4"
                          aria-label={`Activar ${CATEGORY_LABELS[category]}`}
                        />
                        <label htmlFor={`weight-${category}`} className="flex-1 text-sm">
                          {CATEGORY_LABELS[category]}
                        </label>
                        <Input
                          id={`weight-${category}`}
                          type="number"
                          min={0}
                          max={100}
                          step="1"
                          disabled={!enabled[category]}
                          className="h-9 w-20 text-right"
                          value={weights[category] ?? "0"}
                          onChange={(e) => setWeights((prev) => ({ ...prev, [category]: e.target.value }))}
                        />
                        <span className="text-xs text-muted-foreground">%</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={!enabled[category]}
                          onClick={() => setExpandedCategory(isExpanded ? null : category)}
                        >
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          Subpesos{rows.length > 0 ? ` (${rows.length})` : ""}
                        </Button>
                      </div>

                      {isExpanded && enabled[category] ? (
                        <div className="mt-3 space-y-2 rounded-md bg-muted/40 p-3">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-medium text-muted-foreground">
                              Subpeso por característica dentro de «{CATEGORY_LABELS[category]}»
                            </p>
                            <SumBadge
                              total={featureTotalsByCategory[category] ?? 0}
                              emptyHint="Sin subpesos — cada característica pesa el 100% de la categoría"
                            />
                          </div>
                          {rows.map((row, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <Input
                                list={`known-features-${category}`}
                                placeholder="Nombre exacto de la característica (p. ej. mrz_check_digit)"
                                className="h-9 flex-1"
                                value={row.name}
                                onChange={(e) =>
                                  setFeatureRows((prev) => ({
                                    ...prev,
                                    [category]: prev[category]!.map((r, i) => (i === index ? { ...r, name: e.target.value } : r)),
                                  }))
                                }
                              />
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                step="1"
                                className="h-9 w-20 text-right"
                                value={row.weight}
                                onChange={(e) =>
                                  setFeatureRows((prev) => ({
                                    ...prev,
                                    [category]: prev[category]!.map((r, i) => (i === index ? { ...r, weight: e.target.value } : r)),
                                  }))
                                }
                              />
                              <span className="text-xs text-muted-foreground">%</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() =>
                                  setFeatureRows((prev) => ({ ...prev, [category]: prev[category]!.filter((_, i) => i !== index) }))
                                }
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          ))}
                          <datalist id={`known-features-${category}`}>
                            {suggestions.map((name) => (
                              <option key={name} value={name} />
                            ))}
                          </datalist>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setFeatureRows((prev) => ({ ...prev, [category]: [...(prev[category] ?? []), { name: "", weight: "0" }] }))
                            }
                          >
                            <Plus className="h-4 w-4" /> Agregar característica
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
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
                hint="Cuando está activo, cada vez que se consulta el estado de una validación el sistema calcula el porcentaje de concordancia documental de la Validación de ID y, si queda por debajo del umbral, marca el proceso como Rechazado (por no concordancia documental) — sin importar el resultado que haya devuelto el proveedor de biometría."
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

          <div className="flex items-center justify-end gap-3">
            {!canSave ? (
              <p className="text-xs text-destructive">
                {!categoryTotalValid
                  ? "Los pesos de las categorías activas deben sumar 100% antes de guardar."
                  : "Los subpesos de al menos una categoría no suman 100% antes de guardar."}
              </p>
            ) : null}
            <Button onClick={handleSave} disabled={updateConfig.isPending || !canSave}>
              Guardar
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

import type { NaatCheckRecheckResultDto } from "@fad-console/shared-types";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { useAuth } from "../../lib/auth-context";
import { useTriggerNaatCheckRecheck } from "../../features/executions/useExecutions";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { useToast } from "../ui/toast";

function riskTone(risk: string): "success" | "warning" | "error" {
  if (risk === "LOW") return "success";
  if (risk === "MEDIUM") return "warning";
  return "error";
}

/**
 * Botón "Reevaluar con NAAT-CHECK" — dispara una consulta real y síncrona contra NAAT-CHECK
 * (NAAT.TECH "API RECHECK PROCESS") con las imágenes del documento ya capturadas, fuera del flujo
 * principal. Nunca fabrica un resultado: si NAAT-CHECK no está configurado o la llamada falla, se
 * muestra el error real. El último resultado (si existe) también aparece como una fila en la
 * tabla de "Validación de ID" (categoría NAAT-CHECK), ya que participa en la puntuación por
 * categoría.
 */
export function NaatCheckRecheckPanel({ executionId, result }: { executionId: string; result: NaatCheckRecheckResultDto | null }) {
  const { user } = useAuth();
  const trigger = useTriggerNaatCheckRecheck();
  const { notify } = useToast();

  if (user?.role !== "ADMIN" && user?.role !== "OPERATOR") return null;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Reevaluación NAAT-CHECK (bajo pedido)</CardTitle>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={trigger.isPending}
          onClick={async () => {
            try {
              await trigger.mutateAsync(executionId);
              notify({ title: "Reevaluación NAAT-CHECK completada", tone: "success" });
            } catch (error) {
              notify({ title: "No se pudo reevaluar con NAAT-CHECK", description: (error as Error).message, tone: "error" });
            }
          }}
        >
          {trigger.isPending ? "Reevaluando…" : "Reevaluar con NAAT-CHECK"}
        </Button>
      </CardHeader>
      <CardContent>
        {result ? (
          <div className="flex items-start gap-2 text-sm">
            {result.risk === "LOW" ? <ShieldCheck className="mt-0.5 h-4 w-4 text-success" /> : <AlertTriangle className="mt-0.5 h-4 w-4 text-warning" />}
            <div>
              <div className="flex items-center gap-2">
                <Badge tone={riskTone(result.risk)}>Riesgo: {result.risk}</Badge>
                {result.key ? <span className="text-xs text-muted-foreground">{result.key}</span> : null}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Consultado el {new Date(result.requestedAt).toLocaleString()} — fuera del flujo principal, no reemplaza el
                resultado del proveedor de biometría.
              </p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Todavía no se ha disparado una reevaluación NAAT-CHECK para esta ejecución.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

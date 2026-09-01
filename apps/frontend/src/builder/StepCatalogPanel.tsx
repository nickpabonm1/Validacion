import { STEP_CATALOG } from "@fad-console/shared-types";
import { Plus, FlaskConical } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";

interface StepCatalogPanelProps {
  addedStepKeys: string[];
  onAdd: (stepKey: string) => void;
}

export function StepCatalogPanel({ addedStepKeys, onAdd }: StepCatalogPanelProps) {
  return (
    <div className="flex h-full flex-col gap-2 overflow-y-auto pr-1">
      <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Catálogo de pasos
      </h2>
      {STEP_CATALOG.map((step) => {
        const added = addedStepKeys.includes(step.key);
        return (
          <Card key={step.key} className="p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-sm font-medium">{step.label}</p>
                  {step.experimental ? <FlaskConical className="h-3.5 w-3.5 shrink-0 text-warning" /> : null}
                </div>
                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{step.description}</p>
              </div>
              <Button
                size="icon"
                variant={added ? "ghost" : "outline"}
                disabled={added}
                aria-label={`Agregar paso ${step.label}`}
                onClick={() => onAdd(step.key)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

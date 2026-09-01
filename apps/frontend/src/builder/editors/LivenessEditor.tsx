import { Input } from "../../components/ui/input";
import { Field, InlineSwitchField } from "./Field";
import type { StepEditorProps } from "./types";

export function LivenessEditor({ step, onChange }: StepEditorProps) {
  const features = step.features ?? {};
  return (
    <div className="space-y-4">
      <Field label="Proveedor (ID numérico)" hint="Consulta el catálogo en Catálogos si no conoces el ID.">
        <Input
          type="number"
          value={String(features.provider ?? "")}
          onChange={(e) => onChange({ features: { ...features, provider: Number(e.target.value) } })}
        />
      </Field>
      <InlineSwitchField
        label="Vista requerida"
        checked={Boolean(features.viewRequired)}
        onChange={(v) => onChange({ features: { ...features, viewRequired: v } })}
      />
    </div>
  );
}

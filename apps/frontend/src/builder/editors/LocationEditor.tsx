import { Textarea } from "../../components/ui/input";
import { Field, InlineSwitchField } from "./Field";
import type { StepEditorProps } from "./types";

export function LocationEditor({ step, onChange }: StepEditorProps) {
  const configuration = step.configuration ?? {};
  const features = step.features ?? {};

  return (
    <div className="space-y-4">
      <InlineSwitchField
        label="Siempre solicitar ubicación"
        checked={Boolean(features.alwaysAskLocation)}
        onChange={(checked) => onChange({ features: { ...features, alwaysAskLocation: checked } })}
      />
      <InlineSwitchField
        label="Requerir autorización de geolocalización"
        checked={Boolean(configuration.requireLocationAuthorization)}
        onChange={(checked) => onChange({ configuration: { ...configuration, requireLocationAuthorization: checked } })}
      />
      <Field label="Texto explicativo" hint="Se muestra al usuario antes de solicitar su ubicación.">
        <Textarea
          rows={3}
          value={String(configuration.explanatoryText ?? "")}
          onChange={(e) => onChange({ configuration: { ...configuration, explanatoryText: e.target.value } })}
        />
      </Field>
    </div>
  );
}

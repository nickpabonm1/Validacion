import { Input } from "../../components/ui/input";
import { Field } from "./Field";
import type { StepEditorProps } from "./types";

export function IdDetectionEditor({ step, onChange }: StepEditorProps) {
  const configuration = step.configuration ?? {};

  return (
    <div className="space-y-4">
      <Field label="Segundo de inicio" hint="Momento (en segundos) en que inicia la lectura del acuerdo en video.">
        <Input
          type="number"
          min={0}
          value={String(configuration.startSecond ?? 0)}
          onChange={(e) => onChange({ configuration: { ...configuration, startSecond: Number(e.target.value) } })}
        />
      </Field>
      <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
        Los archivos capturados (frontal, posterior, selfie, video) son generados por el SDK oficial durante la
        ejecución real y no se configuran manualmente aquí.
      </p>
    </div>
  );
}

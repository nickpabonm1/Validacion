import { Input, Textarea } from "../../components/ui/input";
import { Field } from "./Field";
import type { StepEditorProps } from "./types";

interface TimerRecording {
  min?: number;
  max?: number;
}

/** `input.legend` — texto que el cliente debe leer en voz alta durante la grabación del acuerdo
 * en video. Campo obligatorio: confirmado con un error real de FAD ({"code":
 * "InvalidInputParameter","message":"Invalid step videoagreement, property input -> legend is
 * required"}), no documentado en el PDF ni en la colección Postman.
 *
 * `configuration.timer.recording.{min,max}` — duración mínima/máxima de la grabación en
 * segundos. Opcional, tampoco documentado, pero confirmado que FAD lo acepta. */
export function VideoagreementEditor({ step, onChange }: StepEditorProps) {
  const legend = String(step.input?.legend ?? "");
  const configuration = step.configuration ?? {};
  const timer = (configuration.timer as { recording?: TimerRecording } | undefined) ?? {};
  const recording = timer.recording ?? {};

  function setRecording(patch: TimerRecording) {
    onChange({
      configuration: { ...configuration, timer: { ...timer, recording: { ...recording, ...patch } } },
    });
  }

  return (
    <div className="space-y-4">
      <Field
        label="Texto del acuerdo (legend)"
        hint="El cliente lo lee en voz alta durante la grabación. Obligatorio: el proveedor de biometría rechaza el paso sin este texto."
      >
        <Textarea
          rows={4}
          value={legend}
          onChange={(e) => onChange({ input: { ...step.input, legend: e.target.value } })}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Grabación mínima (segundos)" hint="Opcional: configuration.timer.recording.min">
          <Input
            type="number"
            min={0}
            value={recording.min ?? ""}
            onChange={(e) => setRecording({ min: e.target.value === "" ? undefined : Number(e.target.value) })}
          />
        </Field>
        <Field label="Grabación máxima (segundos)" hint="Opcional: configuration.timer.recording.max">
          <Input
            type="number"
            min={0}
            value={recording.max ?? ""}
            onChange={(e) => setRecording({ max: e.target.value === "" ? undefined : Number(e.target.value) })}
          />
        </Field>
      </div>
    </div>
  );
}

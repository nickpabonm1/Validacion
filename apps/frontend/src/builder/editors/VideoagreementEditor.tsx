import { Textarea } from "../../components/ui/input";
import { Field } from "./Field";
import type { StepEditorProps } from "./types";

/** `input.legend` — texto que el cliente debe leer en voz alta durante la grabación del acuerdo
 * en video. Campo obligatorio: confirmado con un error real de FAD ({"code":
 * "InvalidInputParameter","message":"Invalid step videoagreement, property input -> legend is
 * required"}), no documentado en el PDF ni en la colección Postman. */
export function VideoagreementEditor({ step, onChange }: StepEditorProps) {
  const legend = String(step.input?.legend ?? "");

  return (
    <div className="space-y-4">
      <Field
        label="Texto del acuerdo (legend)"
        hint="El cliente lo lee en voz alta durante la grabación. Obligatorio: FAD rechaza el paso sin este texto."
      >
        <Textarea
          rows={4}
          value={legend}
          onChange={(e) => onChange({ input: { ...step.input, legend: e.target.value } })}
        />
      </Field>
    </div>
  );
}

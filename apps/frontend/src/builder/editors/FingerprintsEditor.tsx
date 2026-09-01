import { Select } from "../../components/ui/select";
import { Checkbox } from "../../components/ui/checkbox";
import { Field } from "./Field";
import type { StepEditorProps } from "./types";

const FINGER_LABELS = ["Pulgar", "Índice", "Medio", "Anular", "Meñique"];

export function FingerprintsEditor({ step, onChange }: StepEditorProps) {
  const configuration = step.configuration ?? {};
  const fingers = Array.isArray(configuration.fingers) ? (configuration.fingers as string[]) : [];

  function toggleFinger(code: string, checked: boolean) {
    const next = checked ? [...fingers, code] : fingers.filter((f) => f !== code);
    if (next.length > 10) return;
    onChange({ configuration: { ...configuration, fingers: next } });
  }

  return (
    <div className="space-y-4">
      <Field label="Formato de archivo">
        <Select
          value={String(configuration.format ?? "both")}
          onChange={(e) => onChange({ configuration: { ...configuration, format: e.target.value } })}
        >
          <option value="wsq">WSQ</option>
          <option value="jpeg">JPEG</option>
          <option value="both">WSQ + JPEG</option>
        </Select>
      </Field>

      <div>
        <p className="mb-2 text-sm font-medium">
          Dedos requeridos ({fingers.length}/10) <span className="text-xs text-muted-foreground">entre 1 y 10</span>
        </p>
        <div className="grid grid-cols-2 gap-4">
          {(["L", "R"] as const).map((side) => (
            <div key={side} className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">{side === "L" ? "Mano izquierda" : "Mano derecha"}</p>
              {FINGER_LABELS.map((label, index) => {
                const code = `${side}${index + 1}`;
                return (
                  <label key={code} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={fingers.includes(code)} onCheckedChange={(v) => toggleFinger(code, v === true)} />
                    {label}
                  </label>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { JsonTextEditor } from "./JsonTextEditor";
import type { StepEditorProps } from "./types";

/** Editor JSON avanzado, disponible para TODOS los pasos (sección 10 del brief: "para pasos
 * sin contrato detallado, proporcionar un editor JSON avanzado validado, no campos
 * inventados"). Permite editar `configuration`, `features` e `input` directamente. */
export function AdvancedJsonEditor({ step, onChange, defaultOpen = false }: StepEditorProps & { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-md border border-border">
      <button
        type="button"
        className="flex w-full items-center gap-2 p-3 text-sm font-medium"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        Editor JSON avanzado
      </button>
      {open ? (
        <div className="space-y-3 border-t border-border p-3">
          <JsonTextEditor
            label="configuration"
            value={step.configuration ?? {}}
            onChange={(v) => onChange({ configuration: v })}
          />
          <JsonTextEditor label="features" value={step.features ?? {}} onChange={(v) => onChange({ features: v })} />
          <JsonTextEditor label="input" value={step.input ?? {}} onChange={(v) => onChange({ input: v })} />
        </div>
      ) : null}
    </div>
  );
}

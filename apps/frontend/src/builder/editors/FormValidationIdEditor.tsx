import { Plus } from "lucide-react";
import { Button } from "../../components/ui/button";
import { FormCard } from "./FormCard";
import type { StepEditorProps } from "./types";

interface DynamicFormLike {
  default?: boolean;
  classification?: { countryCode: string; cardType: string | number; cardTypeDescription: string };
  fields: Array<Record<string, unknown>>;
}

export function FormValidationIdEditor({ step, onChange }: StepEditorProps) {
  const input = (step.input ?? { forms: [] }) as { forms: DynamicFormLike[] };
  const forms = Array.isArray(input.forms) ? input.forms : [];

  function setForms(next: DynamicFormLike[]) {
    onChange({ input: { ...input, forms: next } });
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Cada formulario aplica a una clasificación de documento específica, o puede marcarse como
        predeterminado (se usa cuando ninguna clasificación coincide).
      </p>
      {forms.map((form, index) => (
        <FormCard
          key={index}
          form={form}
          onChange={(next) => setForms(forms.map((f, i) => (i === index ? next : f)))}
          onRemove={() => setForms(forms.filter((_, i) => i !== index))}
        />
      ))}
      <Button
        variant="outline"
        size="sm"
        onClick={() =>
          setForms([
            ...forms,
            { default: forms.length === 0, fields: [] },
          ])
        }
      >
        <Plus className="h-4 w-4" /> Agregar formulario
      </Button>
    </div>
  );
}

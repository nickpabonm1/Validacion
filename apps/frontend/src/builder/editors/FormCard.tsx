import { Plus, Trash2 } from "lucide-react";
import { FORM_FIELD_INPUT_TYPES } from "@fad-console/shared-types";
import { Card, CardContent, CardHeader } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Button } from "../../components/ui/button";
import { InlineSwitchField } from "./Field";
import { FieldsList } from "./FieldsList";

interface DynamicFormLike {
  default?: boolean;
  classification?: { countryCode: string; cardType: string | number; cardTypeDescription: string };
  fields: Array<Record<string, unknown>>;
}

export function FormCard({
  form,
  onChange,
  onRemove,
}: {
  form: DynamicFormLike;
  onChange: (next: DynamicFormLike) => void;
  onRemove: () => void;
}) {
  const classification = form.classification ?? { countryCode: "", cardType: "", cardTypeDescription: "" };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 p-4 pb-2">
        <p className="text-sm font-semibold">
          {form.default ? "Formulario predeterminado" : classification.cardTypeDescription || "Nuevo formulario"}
        </p>
        <Button variant="ghost" size="icon" aria-label="Eliminar formulario" onClick={onRemove}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-0">
        <InlineSwitchField
          label="Formulario predeterminado"
          checked={Boolean(form.default)}
          onChange={(v) => onChange({ ...form, default: v, classification: v ? undefined : classification })}
        />

        {!form.default ? (
          <div className="grid grid-cols-3 gap-2">
            <Input
              placeholder="País (COL)"
              value={classification.countryCode}
              onChange={(e) => onChange({ ...form, classification: { ...classification, countryCode: e.target.value } })}
            />
            <Input
              placeholder="cardType"
              value={String(classification.cardType)}
              onChange={(e) => onChange({ ...form, classification: { ...classification, cardType: e.target.value } })}
            />
            <Input
              placeholder="Descripción"
              value={classification.cardTypeDescription}
              onChange={(e) =>
                onChange({ ...form, classification: { ...classification, cardTypeDescription: e.target.value } })
              }
            />
          </div>
        ) : null}

        <FieldsList
          fields={form.fields}
          onChange={(fields) => onChange({ ...form, fields })}
          inputTypes={FORM_FIELD_INPUT_TYPES}
        />

        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            onChange({
              ...form,
              fields: [
                ...form.fields,
                { id: "", inputType: "text", label: "", required: false, order: form.fields.length, visible: true },
              ],
            })
          }
        >
          <Plus className="h-4 w-4" /> Agregar campo
        </Button>
      </CardContent>
    </Card>
  );
}

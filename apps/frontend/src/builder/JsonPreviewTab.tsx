import { useEffect, useState } from "react";
import { CheckCircle2, Pencil, XCircle } from "lucide-react";
import { ValidationRequestConfigSchema, pruneEmptyRequestFields } from "@fad-console/validation-schemas";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/input";
import type { BuilderConfig } from "./types";

interface JsonPreviewTabProps {
  config: BuilderConfig;
  onApply: (config: BuilderConfig) => void;
}

export function JsonPreviewTab({ config, onApply }: JsonPreviewTabProps) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [validation, setValidation] = useState<{ valid: boolean; message: string } | null>(null);

  const prettyJson = JSON.stringify(pruneEmptyRequestFields(config), null, 2);

  useEffect(() => {
    if (!editing) setText(prettyJson);
  }, [prettyJson, editing]);

  function handleValidate() {
    const parsed = ValidationRequestConfigSchema.safeParse(config);
    if (parsed.success) {
      setValidation({ valid: true, message: "El contrato es válido según el esquema conocido del proveedor de biometría." });
    } else {
      setValidation({
        valid: false,
        message: parsed.error.issues.map((issue) => `${issue.path.join(".") || "(raíz)"}: ${issue.message}`).join(" · "),
      });
    }
  }

  function handleFormat() {
    try {
      const parsed = JSON.parse(text);
      setText(JSON.stringify(parsed, null, 2));
    } catch {
      setValidation({ valid: false, message: "No se puede formatear: el JSON tiene errores de sintaxis." });
    }
  }

  function handleApply() {
    try {
      const parsed = JSON.parse(text);
      const result = ValidationRequestConfigSchema.parse(parsed);
      onApply(result);
      setEditing(false);
      setValidation({ valid: true, message: "Cambios aplicados al constructor." });
    } catch (error) {
      setValidation({ valid: false, message: error instanceof Error ? error.message : "JSON inválido" });
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleFormat} disabled={!editing}>
          Formatear JSON
        </Button>
        <Button variant="outline" size="sm" onClick={handleValidate}>
          Validar contrato
        </Button>
        {editing ? (
          <Button size="sm" onClick={handleApply}>
            Aplicar cambios
          </Button>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5" /> Editar JSON directamente
          </Button>
        )}
      </div>

      {validation ? (
        <div
          className={`flex items-start gap-2 rounded-md p-3 text-xs ${
            validation.valid ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
          }`}
        >
          {validation.valid ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}
          <span>{validation.message}</span>
        </div>
      ) : null}

      <Textarea
        value={text}
        readOnly={!editing}
        onChange={(e) => setText(e.target.value)}
        rows={24}
        className={`text-xs ${!editing ? "bg-muted" : ""}`}
        spellCheck={false}
      />
    </div>
  );
}

import { RotateCcw } from "lucide-react";
import { THEME_VARIABLES } from "@fad-console/shared-types";
import type { HeaderItem, ThemeVariable } from "@fad-console/validation-schemas";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Field } from "./editors/Field";

const HEX_PATTERN = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

interface ThemeTabProps {
  theme: ThemeVariable[];
  header: HeaderItem[];
  setTheme: (theme: ThemeVariable[]) => void;
  setHeader: (header: HeaderItem[]) => void;
  resetTheme: () => void;
}

export function ThemeTab({ theme, header, setTheme, setHeader, resetTheme }: ThemeTabProps) {
  function valueFor(key: string): string {
    return theme.find((t) => t.key === key)?.value ?? "";
  }

  function setValue(key: string, value: string) {
    const exists = theme.some((t) => t.key === key);
    if (value === "") {
      setTheme(theme.filter((t) => t.key !== key));
      return;
    }
    setTheme(exists ? theme.map((t) => (t.key === key ? { ...t, value } : t)) : [...theme, { key, value }]);
  }

  const headerUrl = header[0]?.content ?? "";

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tema visual</p>
        <Button variant="ghost" size="sm" onClick={resetTheme}>
          <RotateCcw className="h-3.5 w-3.5" /> Restaurar
        </Button>
      </div>

      <div className="space-y-3">
        {THEME_VARIABLES.map((variable) => {
          const value = valueFor(variable.key);
          const isColor = HEX_PATTERN.test(value || variable.sampleValue);
          return (
            <Field key={variable.key} label={variable.label} hint={variable.description}>
              <div className="flex items-center gap-2">
                {isColor ? (
                  <input
                    type="color"
                    value={HEX_PATTERN.test(value) ? value : variable.sampleValue}
                    onChange={(e) => setValue(variable.key, e.target.value)}
                    className="h-9 w-10 shrink-0 rounded border border-input bg-card"
                    aria-label={`Selector de color para ${variable.label}`}
                  />
                ) : null}
                <Input
                  placeholder={variable.sampleValue}
                  value={value}
                  onChange={(e) => setValue(variable.key, e.target.value)}
                  className="font-mono text-xs"
                />
              </div>
            </Field>
          );
        })}
      </div>

      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Encabezado</p>
        <Field label="URL del logo (imagen)" hint="Se valida como URL. Tipo IMG únicamente por ahora.">
          <Input
            type="url"
            placeholder="https://…/logo.png"
            value={headerUrl}
            onChange={(e) => setHeader(e.target.value ? [{ type: "IMG", content: e.target.value }] : [])}
          />
        </Field>
        {headerUrl ? (
          <div className="mt-3 flex items-center justify-center rounded-md border border-dashed border-border bg-muted p-6">
            <img src={headerUrl} alt="Vista previa del encabezado" className="max-h-16 object-contain" />
          </div>
        ) : null}
      </div>
    </div>
  );
}

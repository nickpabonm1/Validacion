import { RotateCcw } from "lucide-react";
import { THEME_VARIABLES } from "@fad-console/shared-types";
import type { HeaderItem, ThemeVariable } from "@fad-console/validation-schemas";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Field } from "./editors/Field";
import { toHexColor } from "../lib/css-color";
import { THEME_PRESETS } from "./theme-presets";

interface ThemeTabProps {
  theme: ThemeVariable[];
  header: HeaderItem[];
  setTheme: (theme: ThemeVariable[]) => void;
  setHeader: (header: HeaderItem[]) => void;
  resetTheme: () => void;
}

const GROUPS = [...new Set(THEME_VARIABLES.map((v) => v.group))];

function valueFor(theme: ThemeVariable[], key: string): string {
  return theme.find((t) => t.key === key)?.value ?? "";
}

export function ThemeTab({ theme, header, setTheme, setHeader, resetTheme }: ThemeTabProps) {
  function setValue(key: string, value: string) {
    const exists = theme.some((t) => t.key === key);
    if (value === "") {
      setTheme(theme.filter((t) => t.key !== key));
      return;
    }
    setTheme(exists ? theme.map((t) => (t.key === key ? { ...t, value } : t)) : [...theme, { key, value }]);
  }

  const headerUrl = header[0]?.content ?? "";

  const previewVars = Object.fromEntries(
    THEME_VARIABLES.map((v) => [v.key, valueFor(theme, v.key) || v.sampleValue]),
  ) as Record<string, string>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tema visual</p>
        <Button variant="ghost" size="sm" onClick={resetTheme}>
          <RotateCcw className="h-3.5 w-3.5" /> Restaurar
        </Button>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Vista previa</p>
        <ThemePreview vars={previewVars} logoUrl={headerUrl} />
      </div>

      <div>
        <p className="mb-2 text-xs text-muted-foreground">
          Aplica una combinación completa con un clic y ajusta lo que necesites después.
        </p>
        <div className="flex flex-col gap-2">
          {THEME_PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              title={preset.description}
              onClick={() => setTheme(preset.theme)}
              className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-left text-xs hover:border-primary hover:bg-muted"
            >
              <span className="flex h-4 w-4 shrink-0 overflow-hidden rounded-full border border-black/10">
                {["--fad-common-primary-color", "--fad-common-secondary-color"].map((key) => (
                  <span
                    key={key}
                    className="h-full w-1/2"
                    style={{ backgroundColor: preset.theme.find((t) => t.key === key)?.value }}
                  />
                ))}
              </span>
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      {GROUPS.map((group) => (
        <div key={group} className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group}</p>
          {THEME_VARIABLES.filter((v) => v.group === group).map((variable) => {
            const value = valueFor(theme, variable.key);
            const hex = toHexColor(value || variable.sampleValue);
            return (
              <Field key={variable.key} label={variable.label} hint={variable.description}>
                <div className="flex items-center gap-2">
                  {hex ? (
                    <input
                      type="color"
                      value={hex}
                      onChange={(e) => setValue(variable.key, e.target.value)}
                      className="h-9 w-10 shrink-0 rounded border border-input bg-card"
                      aria-label={`Selector de color para ${variable.label}`}
                    />
                  ) : null}
                  <Input
                    placeholder={variable.sampleValue}
                    value={value}
                    onChange={(e) => setValue(variable.key, e.target.value)}
                    className="min-w-0 font-mono text-xs"
                  />
                </div>
              </Field>
            );
          })}
        </div>
      ))}

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
      </div>
    </div>
  );
}

function ThemePreview({ vars, logoUrl }: { vars: Record<string, string>; logoUrl: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <div
        className="flex flex-col items-center gap-3 p-5 text-center"
        style={{ backgroundColor: vars["--fad-common-primary-color"] }}
      >
        {logoUrl ? (
          <img src={logoUrl} alt="Vista previa del encabezado" className="max-h-10 object-contain" />
        ) : (
          <div className="flex h-10 items-center text-xs" style={{ color: vars["--fad-common-legends-color"] }}>
            (sin logo configurado)
          </div>
        )}
        <p className="text-sm font-medium" style={{ color: vars["--fad-common-legends-color"] }}>
          Ejemplo de proceso de validación
        </p>
        <p className="text-xs" style={{ color: vars["--fad-common-tertiary-color"] }}>
          Paso 1 de 3
        </p>
      </div>

      <div className="space-y-3 bg-card p-4">
        <button
          type="button"
          className="w-full py-2 text-sm font-medium"
          style={{
            backgroundColor: vars["--fad-common-primary-button-background-color"],
            color: vars["--fad-common-primary-button-label-color"],
            borderRadius: vars["--fad-common-button-common-border-radius"],
          }}
        >
          Continuar
        </button>
        <button
          type="button"
          className="w-full border py-2 text-sm font-medium"
          style={{
            backgroundColor: vars["--fad-common-secondary-button-background-color"],
            color: vars["--fad-common-secondary-button-label-color"],
            borderColor: vars["--fad-common-secondary-button-border-color"],
            borderRadius: vars["--fad-common-button-common-border-radius"],
          }}
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled
          className="w-full cursor-not-allowed py-2 text-sm font-medium"
          style={{
            backgroundColor: vars["--fad-common-button-common-background-color-disabled"],
            color: vars["--fad-common-button-common-label-color-disabled"],
            borderRadius: vars["--fad-common-button-common-border-radius"],
          }}
        >
          Deshabilitado
        </button>
        <p className="text-center text-xs font-medium" style={{ color: vars["--fad-common-successful-color"] }}>
          ✓ Validación exitosa
        </p>
      </div>
    </div>
  );
}

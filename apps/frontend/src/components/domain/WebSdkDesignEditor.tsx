import { useId, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import {
  FONT_FAMILY_SUGGESTIONS,
  fontSizePx,
  isSixDigitHex,
  parseConfigurationJson,
  readFadCustomization,
  toFontSizeCss,
  writeFadCustomization,
  type FadButtonStyle,
  type FadCustomization,
  type FadFontStyle,
} from "../../lib/websdk-design";
import { Input, Textarea } from "../ui/input";
import { Button } from "../ui/button";
import { Label } from "../ui/label";

const DEFAULT_SWATCH = "#94a3b8";

function ColorField({ label, value, onChange }: { label: string; value: string | undefined; onChange: (value: string | undefined) => void }) {
  const id = useId();
  const pickerValue = isSixDigitHex(value) ? value : DEFAULT_SWATCH;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={label}
          value={pickerValue}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-10 shrink-0 cursor-pointer rounded-md border border-input bg-card p-1"
        />
        <Input
          id={id}
          value={value ?? ""}
          placeholder="#A70635"
          onChange={(e) => onChange(e.target.value || undefined)}
        />
      </div>
    </div>
  );
}

function FontField({ label, value, onChange }: { label: string; value: FadFontStyle | undefined; onChange: (value: FadFontStyle) => void }) {
  const familyId = useId();
  const sizeId = useId();
  return (
    <div className="space-y-1.5 rounded-md border border-border p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor={familyId} className="text-xs">
            Tipografía
          </Label>
          <Input
            id={familyId}
            list="websdk-font-suggestions"
            value={value?.fontFamily ?? ""}
            placeholder="system-ui"
            onChange={(e) => onChange({ ...value, fontFamily: e.target.value || undefined })}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={sizeId} className="text-xs">
            Tamaño (px)
          </Label>
          <Input
            id={sizeId}
            type="number"
            min={8}
            max={64}
            value={fontSizePx(value?.fontSize) ?? ""}
            onChange={(e) => onChange({ ...value, fontSize: toFontSizeCss(e.target.value === "" ? undefined : Number(e.target.value)) })}
          />
        </div>
      </div>
    </div>
  );
}

function ButtonStyleFields({
  label,
  value,
  onChange,
}: {
  label: string;
  value: FadButtonStyle | undefined;
  onChange: (value: FadButtonStyle) => void;
}) {
  return (
    <div className="space-y-2 rounded-md border border-border p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="grid grid-cols-2 gap-2">
        <ColorField label="Fondo" value={value?.backgroundColor} onChange={(v) => onChange({ ...value, backgroundColor: v })} />
        <ColorField label="Texto" value={value?.labelColor} onChange={(v) => onChange({ ...value, labelColor: v })} />
      </div>
    </div>
  );
}

/** Vista previa en vivo de una pantalla de captura genérica del Web SDK, con los colores y
 * tipografías elegidos aplicados vía `style` inline — no es la pantalla real del SDK (esa corre
 * dentro de un iframe de terceros que no se puede reproducir aquí), sino una maqueta fiel a la
 * estructura documentada (título + subtítulo + instrucciones + botón primario/secundario) para
 * que el operador vea el efecto de sus cambios sin tener que iniciar una captura real. */
function DesignPreview({ fad }: { fad: FadCustomization }) {
  const primary = isSixDigitHex(fad.colors?.primary) ? fad.colors!.primary! : "#A70635";
  const tertiary = isSixDigitHex(fad.colors?.tertiary) ? fad.colors!.tertiary! : "#363636";
  const titleFont = fad.fonts?.title;
  const subtitleFont = fad.fonts?.subtitle;
  const contentFont = fad.fonts?.content;
  const buttonFont = fad.fonts?.button;
  const primaryButton = fad.buttons?.primary;
  const secondaryButton = fad.buttons?.secondary;

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-background">
      <div className="space-y-1 p-4" style={{ color: tertiary }}>
        <p style={{ fontFamily: titleFont?.fontFamily, fontSize: titleFont?.fontSize ?? "20px", fontWeight: 600 }}>Identificación</p>
        <p style={{ fontFamily: subtitleFont?.fontFamily, fontSize: subtitleFont?.fontSize ?? "14px", opacity: 0.8 }}>
          Captura tu identificación
        </p>
        <p style={{ fontFamily: contentFont?.fontFamily, fontSize: contentFont?.fontSize ?? "12px", opacity: 0.65 }}>
          Coloca tu documento dentro del marco, evita reflejos.
        </p>
      </div>
      <div className="flex items-center justify-center border-t border-dashed border-border bg-muted/40 py-10 text-xs text-muted-foreground">
        (vista previa — el módulo real corre en un iframe del SDK)
      </div>
      <div className="flex gap-2 p-4">
        <button
          type="button"
          disabled
          className="flex-1 rounded-md px-3 py-2 text-sm"
          style={{
            backgroundColor: primaryButton?.backgroundColor ?? primary,
            color: primaryButton?.labelColor ?? "#ffffff",
            fontFamily: buttonFont?.fontFamily,
            fontSize: buttonFont?.fontSize,
          }}
        >
          Continuar
        </button>
        <button
          type="button"
          disabled
          className="flex-1 rounded-md border px-3 py-2 text-sm"
          style={{
            backgroundColor: secondaryButton?.backgroundColor ?? "transparent",
            color: secondaryButton?.labelColor ?? tertiary,
            borderColor: tertiary,
            fontFamily: buttonFont?.fontFamily,
            fontSize: buttonFont?.fontSize,
          }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

/**
 * Editor visual de colores/tipografías para el `configuration` de un módulo del Web SDK (Acuant,
 * Regula, CaptureId o Facetec) — sin escribir JSON: solo selectores de color y campos de fuente,
 * con vista previa en vivo. Edita únicamente `configuration.customization.fadCustomization`
 * (colores + tipografías), que es idéntico en los 4 módulos (ver `websdk-design.ts`); el resto
 * de la configuración (leyendas, vistas, comportamiento) sigue disponible como JSON avanzado,
 * colapsado por defecto, para no perder ningún campo que el docx/PDF documenta pero este editor
 * no cubre.
 */
export function WebSdkDesignEditor({
  moduleLabel,
  configurationText,
  onConfigurationChange,
}: {
  moduleLabel: string;
  configurationText: string;
  onConfigurationChange: (text: string) => void;
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const configuration = parseConfigurationJson(configurationText);
  const fad = readFadCustomization(configuration);

  function update(patch: Partial<FadCustomization>) {
    onConfigurationChange(writeFadCustomization(configurationText, { ...fad, ...patch }));
  }

  return (
    <div className="space-y-4 md:col-span-2">
      <datalist id="websdk-font-suggestions">
        {FONT_FAMILY_SUGGESTIONS.map((f) => (
          <option key={f} value={f} />
        ))}
      </datalist>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            <ColorField label="Primario" value={fad.colors?.primary} onChange={(v) => update({ colors: { ...fad.colors, primary: v } })} />
            <ColorField
              label="Secundario"
              value={fad.colors?.secondary}
              onChange={(v) => update({ colors: { ...fad.colors, secondary: v } })}
            />
            <ColorField label="Terciario" value={fad.colors?.tertiary} onChange={(v) => update({ colors: { ...fad.colors, tertiary: v } })} />
          </div>
          <ButtonStyleFields
            label="Botón primario"
            value={fad.buttons?.primary}
            onChange={(v) => update({ buttons: { ...fad.buttons, primary: v } })}
          />
          <ButtonStyleFields
            label="Botón secundario"
            value={fad.buttons?.secondary}
            onChange={(v) => update({ buttons: { ...fad.buttons, secondary: v } })}
          />
          <div className="grid grid-cols-2 gap-2">
            <FontField label="Título" value={fad.fonts?.title} onChange={(v) => update({ fonts: { ...fad.fonts, title: v } })} />
            <FontField label="Subtítulo" value={fad.fonts?.subtitle} onChange={(v) => update({ fonts: { ...fad.fonts, subtitle: v } })} />
            <FontField label="Contenido" value={fad.fonts?.content} onChange={(v) => update({ fonts: { ...fad.fonts, content: v } })} />
            <FontField label="Botones" value={fad.fonts?.button} onChange={(v) => update({ fonts: { ...fad.fonts, button: v } })} />
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Vista previa — {moduleLabel}</p>
          <DesignPreview fad={fad} />
        </div>
      </div>

      <div>
        <Button type="button" variant="outline" size="sm" onClick={() => setShowAdvanced((v) => !v)}>
          {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          {showAdvanced ? "Ocultar JSON avanzado" : "Ver JSON avanzado (leyendas, vistas, comportamiento)"}
        </Button>
        {showAdvanced ? (
          <Textarea
            className="mt-2"
            rows={10}
            spellCheck={false}
            value={configurationText}
            onChange={(e) => onConfigurationChange(e.target.value)}
          />
        ) : null}
      </div>
    </div>
  );
}

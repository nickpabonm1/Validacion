import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { useProviders } from "../../features/providers/useProviders";
import { Field, InlineSwitchField } from "./Field";
import type { StepEditorProps } from "./types";

export function CaptureIdEditor({ step, onChange }: StepEditorProps) {
  const { data: providers = [] } = useProviders();
  const captureIdProviders = providers.filter((p) => p.providerType === "captureId" && p.enabled);
  const configuration = step.configuration ?? {};
  const features = step.features ?? {};
  const setConfig = (patch: Record<string, unknown>) => onChange({ configuration: { ...configuration, ...patch } });

  return (
    <div className="space-y-4">
      <Field label="Proveedor" hint="Catálogo editable en Catálogos > Proveedores.">
        <Select
          value={String(features.provider ?? "")}
          onChange={(e) => onChange({ features: { ...features, provider: Number(e.target.value) } })}
        >
          <option value="">Selecciona un proveedor</option>
          {captureIdProviders.map((p) => (
            <option key={p.id} value={p.externalProviderId}>
              {p.providerLabel} (id {p.externalProviderId})
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <InlineSwitchField
          label="Captura frontal"
          checked={Boolean(configuration.captureFront)}
          onChange={(v) => setConfig({ captureFront: v })}
        />
        <InlineSwitchField
          label="Captura posterior"
          checked={Boolean(configuration.captureBack)}
          onChange={(v) => setConfig({ captureBack: v })}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="País" hint="Código de país (ej. COL, MEX).">
          <Input value={String(configuration.country ?? "")} onChange={(e) => setConfig({ country: e.target.value })} />
        </Field>
        <Field label="Tipo documental">
          <Input value={String(configuration.documentType ?? "")} onChange={(e) => setConfig({ documentType: e.target.value })} />
        </Field>
      </div>
      <Field label="Descripción documental">
        <Input
          value={String(configuration.documentDescription ?? "")}
          onChange={(e) => setConfig({ documentDescription: e.target.value })}
        />
      </Field>
    </div>
  );
}

import { Input, Textarea } from "../../components/ui/input";
import { Field, InlineSwitchField } from "./Field";
import type { StepEditorProps } from "./types";

export function PrivacyNoticeEditor({ step, onChange }: StepEditorProps) {
  const configuration = step.configuration ?? {};
  const set = (patch: Record<string, unknown>) => onChange({ configuration: { ...configuration, ...patch } });

  return (
    <div className="space-y-4">
      <Field label="Título">
        <Input value={String(configuration.title ?? "")} onChange={(e) => set({ title: e.target.value })} />
      </Field>
      <Field label="Contenido" hint="Texto del aviso de privacidad mostrado al usuario.">
        <Textarea rows={4} value={String(configuration.content ?? "")} onChange={(e) => set({ content: e.target.value })} />
      </Field>
      <Field label="URL del aviso (opcional)">
        <Input
          type="url"
          placeholder="https://…"
          value={String(configuration.url ?? "")}
          onChange={(e) => set({ url: e.target.value })}
        />
      </Field>
      <InlineSwitchField label="Obligatorio" checked={Boolean(configuration.mandatory)} onChange={(v) => set({ mandatory: v })} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Texto de aceptación">
          <Input value={String(configuration.acceptText ?? "")} onChange={(e) => set({ acceptText: e.target.value })} />
        </Field>
        <Field label="Texto de rechazo">
          <Input value={String(configuration.rejectText ?? "")} onChange={(e) => set({ rejectText: e.target.value })} />
        </Field>
      </div>
    </div>
  );
}

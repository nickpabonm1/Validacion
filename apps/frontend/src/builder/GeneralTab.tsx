import { Input } from "../components/ui/input";
import { Field, InlineSwitchField } from "./editors/Field";
import type { BuilderConfig } from "./types";

interface GeneralTabProps {
  config: BuilderConfig;
  setMeta: (v: { processName?: string; validity?: number }) => void;
  setClient: (client: Partial<BuilderConfig["client"]>) => void;
  setRedirectUrl: (url: string) => void;
  setNotifications: (n: Partial<BuilderConfig["notifications"]>) => void;
}

export function GeneralTab({ config, setMeta, setClient, setRedirectUrl, setNotifications }: GeneralTabProps) {
  return (
    <div className="space-y-5">
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Proceso</p>
        <div className="space-y-3">
          <Field label="Nombre del proceso" htmlFor="processName">
            <Input id="processName" value={config.processName} onChange={(e) => setMeta({ processName: e.target.value })} />
          </Field>
          <Field label="Vigencia (días)" htmlFor="validity">
            <Input
              id="validity"
              type="number"
              min={1}
              value={config.validity}
              onChange={(e) => setMeta({ validity: Number(e.target.value) })}
            />
          </Field>
        </div>
      </div>

      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cliente</p>
        <div className="space-y-3">
          <Field label="Nombre" htmlFor="clientName">
            <Input id="clientName" value={config.client.name} onChange={(e) => setClient({ name: e.target.value })} />
          </Field>
          <Field label="Correo" htmlFor="clientMail">
            <Input
              id="clientMail"
              type="email"
              value={config.client.mail}
              onChange={(e) => setClient({ mail: e.target.value })}
            />
          </Field>
          <Field label="Teléfono" htmlFor="clientPhone" hint="Formato internacional, ej. +573001234567">
            <Input id="clientPhone" value={config.client.phone} onChange={(e) => setClient({ phone: e.target.value })} />
          </Field>
        </div>
      </div>

      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Redirección y notificaciones</p>
        <div className="space-y-3">
          <Field label="URL de redirección al finalizar" htmlFor="redirectUrl" hint="Debe ser una URL https.">
            <Input
              id="redirectUrl"
              type="url"
              placeholder="https://…"
              value={config.feature.redirect?.url ?? ""}
              onChange={(e) => setRedirectUrl(e.target.value)}
            />
          </Field>
          <InlineSwitchField
            label="Notificación por correo"
            checked={config.notifications.email}
            onChange={(v) => setNotifications({ email: v })}
          />
          <InlineSwitchField
            label="Notificación por WhatsApp"
            checked={config.notifications.whatsapp}
            onChange={(v) => setNotifications({ whatsapp: v })}
          />
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useSystemSettings, useUpsertSetting, useDeleteSetting } from "../features/settings/useSystemSettings";
import { PageHeader, EmptyState, Skeleton } from "../components/ui/misc";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Field, InlineSwitchField } from "../builder/editors/Field";
import { Badge } from "../components/ui/badge";
import { Card, CardContent } from "../components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "../components/ui/dialog";
import { useToast } from "../components/ui/toast";

export function SettingsPage() {
  const { data: settings, isLoading } = useSystemSettings();
  const upsertSetting = useUpsertSetting();
  const deleteSetting = useDeleteSetting();
  const { notify } = useToast();

  const [open, setOpen] = useState(false);
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [description, setDescription] = useState("");
  const [encrypted, setEncrypted] = useState(false);

  return (
    <div>
      <PageHeader
        title="Configuración"
        description="Parámetros generales del sistema (no relacionados a credenciales de FAD)."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button
                onClick={() => {
                  setKey("");
                  setValue("");
                  setDescription("");
                  setEncrypted(false);
                }}
              >
                <Plus className="h-4 w-4" /> Nuevo parámetro
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nuevo parámetro</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <Field label="Clave" htmlFor="setting-key">
                  <Input id="setting-key" value={key} onChange={(e) => setKey(e.target.value)} />
                </Field>
                <Field label="Valor" htmlFor="setting-value">
                  <Input id="setting-value" value={value} onChange={(e) => setValue(e.target.value)} />
                </Field>
                <Field label="Descripción" htmlFor="setting-desc">
                  <Input id="setting-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
                </Field>
                <InlineSwitchField label="Cifrar valor" checked={encrypted} onChange={setEncrypted} />
              </div>
              <DialogFooter>
                <Button
                  onClick={async () => {
                    await upsertSetting.mutateAsync({ key, value, description, encrypted });
                    notify({ title: "Parámetro guardado", tone: "success" });
                    setOpen(false);
                  }}
                  disabled={!key || !value}
                >
                  Guardar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <h2 className="mb-3 text-sm font-semibold">Parámetros generales</h2>
      {isLoading ? (
        <Skeleton className="h-40" />
      ) : !settings || settings.length === 0 ? (
        <EmptyState title="Sin parámetros configurados" />
      ) : (
        <div className="space-y-2">
          {settings.map((setting) => (
            <Card key={setting.key}>
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-mono text-sm">{setting.key}</p>
                  {setting.description ? <p className="text-xs text-muted-foreground">{setting.description}</p> : null}
                  <p className="mt-1 text-sm">{setting.encrypted ? "•••••••• (cifrado)" : setting.value}</p>
                </div>
                <div className="flex items-center gap-2">
                  {setting.encrypted ? <Badge tone="info">Cifrado</Badge> : null}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={async () => {
                      await deleteSetting.mutateAsync(setting.key);
                      notify({ title: "Parámetro eliminado", tone: "success" });
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

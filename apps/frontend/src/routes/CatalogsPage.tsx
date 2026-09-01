import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { ProviderCatalogEntryInputSchema, type ProviderCatalogEntryInput } from "@fad-console/validation-schemas";
import { useProviders } from "../features/providers/useProviders";
import { useCreateProvider, useDeleteProvider, useUpdateProvider } from "../features/providers/useProvidersAdmin";
import { PageHeader, EmptyState, Skeleton } from "../components/ui/misc";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Field, InlineSwitchField } from "../builder/editors/Field";
import { Badge } from "../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "../components/ui/dialog";
import { useToast } from "../components/ui/toast";

const BLANK: ProviderCatalogEntryInput = {
  providerKey: "",
  providerLabel: "",
  providerType: "captureId",
  externalProviderId: 1,
  enabled: true,
  metadata: {},
};

export function CatalogsPage() {
  const { data: providers, isLoading } = useProviders();
  const createProvider = useCreateProvider();
  const updateProvider = useUpdateProvider();
  const deleteProvider = useDeleteProvider();
  const { notify } = useToast();

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { register, handleSubmit, reset, control } = useForm<ProviderCatalogEntryInput>({
    resolver: zodResolver(ProviderCatalogEntryInputSchema),
    defaultValues: BLANK,
  });

  function openNew() {
    setEditingId(null);
    reset(BLANK);
    setOpen(true);
  }

  function openEdit(id: string) {
    const provider = providers?.find((p) => p.id === id);
    if (!provider) return;
    setEditingId(id);
    reset({
      providerKey: provider.providerKey,
      providerLabel: provider.providerLabel,
      providerType: provider.providerType,
      externalProviderId: provider.externalProviderId,
      enabled: provider.enabled,
      metadata: provider.metadata,
    });
    setOpen(true);
  }

  async function onSubmit(values: ProviderCatalogEntryInput) {
    try {
      if (editingId) {
        await updateProvider.mutateAsync({ id: editingId, input: values });
      } else {
        await createProvider.mutateAsync(values);
      }
      notify({ title: "Proveedor guardado", tone: "success" });
      setOpen(false);
    } catch (error) {
      notify({ title: "Error al guardar", description: (error as Error).message, tone: "error" });
    }
  }

  return (
    <div>
      <PageHeader
        title="Catálogos"
        description="Proveedores de captura de identificación / prueba de vida y su ID externo."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={openNew}>
                <Plus className="h-4 w-4" /> Nuevo proveedor
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingId ? "Editar proveedor" : "Nuevo proveedor"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
                <Field label="Clave interna" htmlFor="providerKey" hint="Identificador único, ej. regula, acuant.">
                  <Input id="providerKey" {...register("providerKey")} />
                </Field>
                <Field label="Nombre visible" htmlFor="providerLabel">
                  <Input id="providerLabel" {...register("providerLabel")} />
                </Field>
                <Field label="Tipo" htmlFor="providerType" hint="ej. captureId, liveness">
                  <Input id="providerType" {...register("providerType")} />
                </Field>
                <Field label="ID externo (usado en features.provider)" htmlFor="externalProviderId">
                  <Input id="externalProviderId" type="number" {...register("externalProviderId", { valueAsNumber: true })} />
                </Field>
                <Controller
                  control={control}
                  name="enabled"
                  render={({ field }) => (
                    <InlineSwitchField label="Proveedor activo" checked={field.value} onChange={field.onChange} />
                  )}
                />
                <DialogFooter>
                  <Button type="submit">Guardar</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {isLoading ? (
        <Skeleton className="h-40" />
      ) : !providers || providers.length === 0 ? (
        <EmptyState title="Sin proveedores en el catálogo" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Clave</th>
                <th className="px-4 py-2.5 font-medium">Nombre</th>
                <th className="px-4 py-2.5 font-medium">Tipo</th>
                <th className="px-4 py-2.5 font-medium">ID externo</th>
                <th className="px-4 py-2.5 font-medium">Estado</th>
                <th className="px-4 py-2.5 font-medium" />
              </tr>
            </thead>
            <tbody>
              {providers.map((provider) => (
                <tr key={provider.id} className="border-t border-border">
                  <td className="px-4 py-2.5 font-mono text-xs">{provider.providerKey}</td>
                  <td className="px-4 py-2.5 cursor-pointer" onClick={() => openEdit(provider.id)}>
                    {provider.providerLabel}
                  </td>
                  <td className="px-4 py-2.5">{provider.providerType}</td>
                  <td className="px-4 py-2.5">{provider.externalProviderId}</td>
                  <td className="px-4 py-2.5">
                    <Badge tone={provider.enabled ? "success" : "neutral"}>{provider.enabled ? "Activo" : "Inactivo"}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={async () => {
                        if (!window.confirm(`¿Eliminar el proveedor "${provider.providerLabel}"?`)) return;
                        await deleteProvider.mutateAsync(provider.id);
                        notify({ title: "Proveedor eliminado", tone: "success" });
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import { Plus, Trash2, Settings2, Building2, Mail } from "lucide-react";
import type { ClientDto } from "@fad-console/shared-types";
import {
  useClients,
  useCreateClient,
  useUpdateClient,
  useUpdateClientBranding,
  useUpdateClientEmailTemplate,
  useDeleteClient,
} from "../features/clients/useClients";
import { PageHeader, EmptyState, Skeleton } from "../components/ui/misc";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "../components/ui/dialog";
import { useToast } from "../components/ui/toast";

// Mismos valores por defecto que `apps/backend/src/modules/messaging/email-template.ts` — se
// duplican aquí solo como texto de referencia para la vista previa del editor (el envío real
// siempre usa la plantilla que resuelve el backend).
const DEFAULT_EMAIL_SUBJECT_TEMPLATE = "{{processName}} — verificación de identidad";
const DEFAULT_EMAIL_BODY_TEMPLATE =
  `<p>Te invitamos a completar tu verificación de identidad (<strong>{{processName}}</strong>).</p>` +
  `<p><a href="{{link}}">Toca aquí desde tu celular para continuar</a></p>` +
  `<p style="color:#666;font-size:12px">Este enlace expira en poco tiempo y solo puede usarse una vez.</p>`;

function renderPreview(template: string, client: ClientDto): string {
  const logo = client.logoDataUrl
    ? `<img src="${client.logoDataUrl}" alt="" style="max-height:48px;max-width:220px;display:block;margin-bottom:16px" />`
    : "";
  return template
    .replace(/\{\{\s*processName\s*\}\}/g, "Onboarding cliente")
    .replace(/\{\{\s*environmentName\s*\}\}/g, "Producción")
    .replace(/\{\{\s*clientName\s*\}\}/g, client.name)
    .replace(/\{\{\s*link\s*\}\}/g, "https://ejemplo.invalid/v/abc123")
    .replace(/\{\{\s*logo\s*\}\}/g, logo);
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("No se pudo leer el archivo"));
    reader.readAsDataURL(file);
  });
}

/** Ordena en orden de árbol (padre antes que sus hijos, hijos agrupados bajo su padre) y calcula
 * la profundidad de cada cliente para indentar la lista igual que un árbol, sin depender de un
 * componente de árbol aparte. */
function sortAsTree(clients: ClientDto[]): Array<ClientDto & { depth: number }> {
  const byParent = new Map<string | null, ClientDto[]>();
  for (const client of clients) {
    const key = client.parentClientId;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(client);
  }
  const result: Array<ClientDto & { depth: number }> = [];
  function visit(parentId: string | null, depth: number) {
    for (const client of byParent.get(parentId) ?? []) {
      result.push({ ...client, depth });
      visit(client.id, depth + 1);
    }
  }
  visit(null, 0);
  return result;
}

function BrandingDialog({ client, open, onOpenChange }: { client: ClientDto; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { notify } = useToast();
  const updateBranding = useUpdateClientBranding();
  const [primaryColor, setPrimaryColor] = useState(client.primaryColor ?? "#1d4ed8");
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(client.logoDataUrl);
  const [faviconDataUrl, setFaviconDataUrl] = useState<string | null>(client.faviconDataUrl);

  async function handleSave() {
    try {
      await updateBranding.mutateAsync({
        id: client.id,
        input: {
          primaryColor: primaryColor || "",
          logoDataUrl: logoDataUrl ?? "",
          faviconDataUrl: faviconDataUrl ?? "",
        },
      });
      notify({ title: "Marca actualizada", tone: "success" });
      onOpenChange(false);
    } catch (error) {
      notify({ title: "Error al guardar la marca", description: (error as Error).message, tone: "error" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Marca de {client.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Logo</Label>
            <div className="flex items-center gap-3">
              {logoDataUrl ? <img src={logoDataUrl} alt="Logo" className="h-10 w-auto rounded border border-border object-contain" /> : null}
              <Input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) setLogoDataUrl(await readFileAsDataUrl(file));
                }}
              />
              {logoDataUrl ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => setLogoDataUrl(null)}>
                  Quitar
                </Button>
              ) : null}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Favicon</Label>
            <div className="flex items-center gap-3">
              {faviconDataUrl ? <img src={faviconDataUrl} alt="Favicon" className="h-6 w-6 rounded border border-border object-contain" /> : null}
              <Input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) setFaviconDataUrl(await readFileAsDataUrl(file));
                }}
              />
              {faviconDataUrl ? (
                <Button type="button" variant="ghost" size="sm" onClick={() => setFaviconDataUrl(null)}>
                  Quitar
                </Button>
              ) : null}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="primary-color">Color principal</Label>
            <div className="flex items-center gap-3">
              <input
                id="primary-color"
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="h-9 w-14 cursor-pointer rounded border border-border"
              />
              <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="w-32" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Esta marca se aplica al header y al favicon para todos los usuarios de {client.name} y, si sus hijos no tienen
            marca propia, también se hereda a ellos.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={updateBranding.isPending}>
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EmailTemplateDialog({ client, open, onOpenChange }: { client: ClientDto; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { notify } = useToast();
  const updateTemplate = useUpdateClientEmailTemplate();
  const [subject, setSubject] = useState(client.emailSubjectTemplate ?? "");
  const [bodyHtml, setBodyHtml] = useState(client.emailBodyTemplate ?? "");

  const hasOwnTemplate = Boolean(client.emailSubjectTemplate || client.emailBodyTemplate);
  const previewSubject = renderPreview(subject || DEFAULT_EMAIL_SUBJECT_TEMPLATE, client);
  const previewBody = renderPreview(bodyHtml || DEFAULT_EMAIL_BODY_TEMPLATE, client);

  async function handleSave() {
    try {
      await updateTemplate.mutateAsync({ id: client.id, input: { emailSubjectTemplate: subject, emailBodyTemplate: bodyHtml } });
      notify({ title: "Plantilla de correo actualizada", tone: "success" });
      onOpenChange(false);
    } catch (error) {
      notify({ title: "Error al guardar la plantilla", description: (error as Error).message, tone: "error" });
    }
  }

  async function handleRestoreDefault() {
    setSubject("");
    setBodyHtml("");
    try {
      await updateTemplate.mutateAsync({ id: client.id, input: { emailSubjectTemplate: "", emailBodyTemplate: "" } });
      notify({ title: "Plantilla restaurada: hereda la del cliente padre o la de la consola", tone: "success" });
    } catch (error) {
      notify({ title: "Error al restaurar la plantilla", description: (error as Error).message, tone: "error" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Plantilla de correo de {client.name}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email-subject">Asunto</Label>
              <Input
                id="email-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={DEFAULT_EMAIL_SUBJECT_TEMPLATE}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email-body">Cuerpo (HTML)</Label>
              <textarea
                id="email-body"
                value={bodyHtml}
                onChange={(e) => setBodyHtml(e.target.value)}
                placeholder={DEFAULT_EMAIL_BODY_TEMPLATE}
                rows={12}
                className="w-full rounded-md border border-border bg-background p-2 font-mono text-xs"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Placeholders disponibles: <code>{"{{processName}}"}</code>, <code>{"{{environmentName}}"}</code>,{" "}
              <code>{"{{clientName}}"}</code>, <code>{"{{link}}"}</code> (enlace de validación) y <code>{"{{logo}}"}</code> (logo
              de {client.name}, si tiene uno configurado).
            </p>
            {!hasOwnTemplate ? (
              <p className="text-xs text-muted-foreground">
                {client.name} todavía no tiene una plantilla propia: hereda la del cliente padre más cercano que sí tenga una,
                o la plantilla por defecto de la consola.
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5">
            <Label>Vista previa (con datos de ejemplo)</Label>
            <div className="rounded-md border border-border bg-white p-3">
              <p className="mb-2 border-b border-border pb-2 text-sm font-medium text-black">{previewSubject}</p>
              <div className="text-sm text-black" dangerouslySetInnerHTML={{ __html: previewBody }} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => void handleRestoreDefault()} disabled={updateTemplate.isPending}>
            Restaurar por defecto
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={updateTemplate.isPending}>
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ClientRow({ client, depth, onAddChild }: { client: ClientDto; depth: number; onAddChild: (parentId: string) => void }) {
  const { notify } = useToast();
  const updateClient = useUpdateClient();
  const deleteClient = useDeleteClient();
  const [brandingOpen, setBrandingOpen] = useState(false);
  const [emailTemplateOpen, setEmailTemplateOpen] = useState(false);

  const canDelete = client.userCount === 0 && client.childCount === 0 && client.environmentCount === 0;

  return (
    <div
      className="flex items-center justify-between gap-3 border-t border-border py-2.5 first:border-t-0"
      style={{ paddingLeft: `${depth * 24}px` }}
    >
      <div className="flex min-w-0 items-center gap-2">
        {client.logoDataUrl ? (
          <img src={client.logoDataUrl} alt="" className="h-6 w-6 shrink-0 rounded object-contain" />
        ) : (
          <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{client.name}</p>
          <p className="text-xs text-muted-foreground">
            {client.userCount} usuario{client.userCount === 1 ? "" : "s"} · {client.childCount} hijo{client.childCount === 1 ? "" : "s"} ·{" "}
            {client.environmentCount} ambiente{client.environmentCount === 1 ? "" : "s"}
          </p>
        </div>
        {!client.active ? <Badge tone="neutral">Inactivo</Badge> : null}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button variant="ghost" size="sm" onClick={() => onAddChild(client.id)}>
          <Plus className="h-3.5 w-3.5" /> Hijo
        </Button>
        <Button variant="ghost" size="icon" aria-label="Marca" onClick={() => setBrandingOpen(true)}>
          <Settings2 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Plantilla de correo" onClick={() => setEmailTemplateOpen(true)}>
          <Mail className="h-4 w-4" />
        </Button>
        <button type="button" onClick={() => updateClient.mutate({ id: client.id, input: { active: !client.active } })}>
          <Badge tone={client.active ? "success" : "neutral"}>{client.active ? "Activo" : "Inactivo"}</Badge>
        </button>
        <Button
          variant="ghost"
          size="icon"
          disabled={!canDelete}
          title={canDelete ? "Eliminar" : "No se puede eliminar: tiene usuarios, ambientes o hijos"}
          onClick={async () => {
            if (!window.confirm(`¿Eliminar "${client.name}"?`)) return;
            try {
              await deleteClient.mutateAsync(client.id);
              notify({ title: "Cliente eliminado", tone: "success" });
            } catch (error) {
              notify({ title: "No se pudo eliminar", description: (error as Error).message, tone: "error" });
            }
          }}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
      <BrandingDialog client={client} open={brandingOpen} onOpenChange={setBrandingOpen} />
      <EmailTemplateDialog client={client} open={emailTemplateOpen} onOpenChange={setEmailTemplateOpen} />
    </div>
  );
}

export function ClientsPage() {
  const { data: clients, isLoading } = useClients();
  const createClient = useCreateClient();
  const { notify } = useToast();
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newParentId, setNewParentId] = useState<string | null>(null);

  const tree = clients ? sortAsTree(clients) : [];

  function openCreate(parentId: string | null) {
    setNewParentId(parentId);
    setNewName("");
    setOpen(true);
  }

  return (
    <div>
      <PageHeader
        title="Clientes"
        description="Cuentas con acceso propio: cada cliente ve solo sus datos y puede administrar sus propios hijos, usuarios y marca."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => openCreate(null)}>
                <Plus className="h-4 w-4" /> Nuevo cliente
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{newParentId ? "Nuevo cliente hijo" : "Nuevo cliente"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="client-name">Nombre</Label>
                  <Input id="client-name" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
                </div>
              </div>
              <DialogFooter>
                <Button
                  disabled={!newName.trim() || createClient.isPending}
                  onClick={async () => {
                    try {
                      await createClient.mutateAsync({ name: newName.trim(), parentClientId: newParentId });
                      notify({ title: "Cliente creado", tone: "success" });
                      setOpen(false);
                    } catch (error) {
                      notify({ title: "Error al crear cliente", description: (error as Error).message, tone: "error" });
                    }
                  }}
                >
                  Crear
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {isLoading ? (
        <Skeleton className="h-40" />
      ) : tree.length === 0 ? (
        <EmptyState title="Sin clientes" description="Crea el primero con el botón de arriba." />
      ) : (
        <div className="rounded-lg border border-border px-3">
          {tree.map((client) => (
            <ClientRow key={client.id} client={client} depth={client.depth} onAddChild={openCreate} />
          ))}
        </div>
      )}
    </div>
  );
}

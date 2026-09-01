import { useNavigate } from "react-router-dom";
import { Copy, FilePlus2, Pencil, PlayCircle, Trash2 } from "lucide-react";
import { useTemplates, useCloneTemplate, useDeleteTemplate } from "../features/templates/useTemplates";
import { PageHeader, Skeleton, EmptyState } from "../components/ui/misc";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { useToast } from "../components/ui/toast";

export function TemplatesPage() {
  const { data: templates, isLoading } = useTemplates();
  const cloneTemplate = useCloneTemplate();
  const deleteTemplate = useDeleteTemplate();
  const navigate = useNavigate();
  const { notify } = useToast();

  return (
    <div>
      <PageHeader
        title="Plantillas"
        description="Configuraciones reutilizables de validación."
        actions={
          <Button onClick={() => navigate("/builder")}>
            <FilePlus2 className="h-4 w-4" /> Nueva plantilla
          </Button>
        }
      />

      {isLoading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : !templates || templates.length === 0 ? (
        <EmptyState
          title="Todavía no hay plantillas"
          description="Crea tu primera plantilla desde el Constructor."
          action={<Button onClick={() => navigate("/builder")}>Ir al Constructor</Button>}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {templates.map((template) => {
            const stepCount = Object.keys(template.requestConfig.steps ?? {}).length;
            return (
              <Card key={template.id}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{template.name}</p>
                      {template.description ? (
                        <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{template.description}</p>
                      ) : null}
                    </div>
                    {template.active ? <Badge tone="success">Activa</Badge> : <Badge tone="neutral">Inactiva</Badge>}
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    {stepCount} paso{stepCount === 1 ? "" : "s"} · versión {template.version}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => navigate(`/builder/${template.id}`)}>
                      <Pencil className="h-3.5 w-3.5" /> Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`/executions/new?templateId=${template.id}`)}
                    >
                      <PlayCircle className="h-3.5 w-3.5" /> Ejecutar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        await cloneTemplate.mutateAsync(template.id);
                        notify({ title: "Plantilla clonada", tone: "success" });
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" /> Clonar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        if (!window.confirm(`¿Eliminar la plantilla "${template.name}"?`)) return;
                        await deleteTemplate.mutateAsync(template.id);
                        notify({ title: "Plantilla eliminada", tone: "success" });
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" /> Eliminar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

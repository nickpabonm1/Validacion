import { useEffect, useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Save, Trash2 } from "lucide-react";
import { FIELD_RENDER_TYPES, SENSITIVITY_LEVELS, RESPONSE_FIELD_GROUPS } from "@fad-console/shared-types";
import { cn } from "@fad-console/ui";
import {
  useResponseViews,
  useCreateResponseView,
  useUpdateResponseView,
  useDeleteResponseView,
  type ResponseFieldConfigDto,
} from "../features/response-views/useResponseViews";
import { useExecutionsList } from "../features/executions/useExecutions";
import { useExecutionDetail } from "../features/executions/useExecutions";
import { PageHeader, EmptyState, Skeleton } from "../components/ui/misc";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Checkbox } from "../components/ui/checkbox";
import { JsonTree } from "../components/domain/JsonTree";
import { CATEGORY_LABELS as DOCUMENT_CHECK_CATEGORY_LABELS } from "../components/domain/DocumentChecksReport";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "../components/ui/dialog";
import { Label } from "../components/ui/label";
import { useToast } from "../components/ui/toast";

const DOCUMENT_CHECK_CATEGORIES = Object.keys(DOCUMENT_CHECK_CATEGORY_LABELS);

function inferRenderType(value: unknown): (typeof FIELD_RENDER_TYPES)[number] {
  if (typeof value === "boolean") return "BOOLEAN";
  if (typeof value === "number") return "NUMBER";
  if (Array.isArray(value)) return "LIST";
  if (value && typeof value === "object") return "JSON";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) return "DATETIME";
  return "TEXT";
}

function FieldRow({
  field,
  onChange,
  onRemove,
}: {
  field: ResponseFieldConfigDto;
  onChange: (next: ResponseFieldConfigDto) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.id });
  const isDocumentChecks = field.renderType === "DOCUMENT_CHECKS";
  const selectedCategories = field.documentCheckCategories ?? [];

  function toggleCategory(category: string, checked: boolean) {
    const next = checked ? [...selectedCategories, category] : selectedCategories.filter((c) => c !== category);
    onChange({ ...field, documentCheckCategories: next });
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("rounded-md border border-border p-2", isDragging && "opacity-60")}
    >
      <div className="grid grid-cols-[auto_1fr_1fr_1fr_1fr_auto_auto_auto] items-center gap-2">
        <button type="button" className="cursor-grab text-muted-foreground active:cursor-grabbing" {...attributes} {...listeners}>
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="min-w-0">
          <p className="truncate font-mono text-[11px] text-muted-foreground">{field.path}</p>
          <Input value={field.label} onChange={(e) => onChange({ ...field, label: e.target.value })} className="h-7 text-xs" />
        </div>
        <Select value={field.group} onChange={(e) => onChange({ ...field, group: e.target.value })} className="h-7 text-xs">
          {RESPONSE_FIELD_GROUPS.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </Select>
        <Select value={field.renderType} onChange={(e) => onChange({ ...field, renderType: e.target.value as ResponseFieldConfigDto["renderType"] })} className="h-7 text-xs">
          {FIELD_RENDER_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
        <Select value={field.sensitivity} onChange={(e) => onChange({ ...field, sensitivity: e.target.value })} className="h-7 text-xs">
          {SENSITIVITY_LEVELS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        <label className="flex items-center gap-1 text-xs" title="Visible">
          <Checkbox checked={field.visible} onCheckedChange={(v) => onChange({ ...field, visible: v === true })} />
          Visible
        </label>
        <label className="flex items-center gap-1 text-xs" title="Solo si tiene valor">
          <Checkbox
            checked={field.showOnlyIfHasValue}
            onCheckedChange={(v) => onChange({ ...field, showOnlyIfHasValue: v === true })}
          />
          Con valor
        </label>
        <Button variant="ghost" size="icon" aria-label="Eliminar campo" onClick={onRemove}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
      {isDocumentChecks ? (
        <div className="mt-2 border-t border-border pt-2">
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">
            Qué mostrar (sin marcar ninguna = todo lo disponible)
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            {DOCUMENT_CHECK_CATEGORIES.map((category) => (
              <label key={category} className="flex items-center gap-1.5 text-xs">
                <Checkbox
                  checked={selectedCategories.includes(category)}
                  onCheckedChange={(v) => toggleCategory(category, v === true)}
                />
                {DOCUMENT_CHECK_CATEGORY_LABELS[category]}
              </label>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ResponseDesignerPage() {
  const { data: views, isLoading: loadingViews } = useResponseViews();
  const createView = useCreateResponseView();
  const updateView = useUpdateResponseView();
  const deleteView = useDeleteResponseView();
  const { data: executions = [] } = useExecutionsList({});
  const { notify } = useToast();

  const [selectedViewId, setSelectedViewId] = useState<string | undefined>(undefined);
  const [fields, setFields] = useState<ResponseFieldConfigDto[]>([]);
  const [sampleExecutionId, setSampleExecutionId] = useState<string | undefined>(undefined);
  const { data: sampleExecution } = useExecutionDetail(sampleExecutionId);
  const [newViewOpen, setNewViewOpen] = useState(false);
  const [newViewName, setNewViewName] = useState("");
  const [newViewKind, setNewViewKind] = useState("CUSTOM");

  const selectedView = views?.find((v) => v.id === selectedViewId);

  useEffect(() => {
    if (!selectedViewId && views && views.length > 0) setSelectedViewId(views[0]!.id);
  }, [views, selectedViewId]);

  useEffect(() => {
    if (selectedView) setFields(selectedView.configuration.fields);
  }, [selectedView]);

  useEffect(() => {
    if (!sampleExecutionId && executions.length > 0) setSampleExecutionId(executions[0]!.id);
  }, [executions, sampleExecutionId]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = fields.findIndex((f) => f.id === active.id);
    const newIndex = fields.findIndex((f) => f.id === over.id);
    setFields(arrayMove(fields, oldIndex, newIndex).map((f, i) => ({ ...f, order: i })));
  }

  function addField(path: string, sampleValue: unknown) {
    if (fields.some((f) => f.path === path)) {
      notify({ title: "El campo ya existe en esta vista", tone: "warning" });
      return;
    }
    const label = path.split(".").pop() ?? path;
    setFields((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        path,
        label: path === "documentChecks" ? "Validación de documento" : label,
        group: path === "documentChecks" ? "Documento" : "Información técnica",
        order: prev.length,
        visible: true,
        showOnlyIfHasValue: false,
        renderType: path === "documentChecks" ? "DOCUMENT_CHECKS" : inferRenderType(sampleValue),
        sensitivity: "INTERNAL",
      },
    ]);
  }

  async function handleSave() {
    if (!selectedView) return;
    try {
      await updateView.mutateAsync({
        id: selectedView.id,
        input: {
          name: selectedView.name,
          description: selectedView.description ?? undefined,
          kind: selectedView.kind,
          templateId: selectedView.templateId,
          isDefault: selectedView.isDefault,
          configuration: { fields },
        },
      });
      notify({ title: "Vista guardada", tone: "success" });
    } catch (error) {
      notify({ title: "Error al guardar", description: (error as Error).message, tone: "error" });
    }
  }

  return (
    <div>
      <PageHeader
        title="Diseñador de vista de respuesta"
        description="Define qué campos se muestran, con qué nombre, orden y formato."
        actions={
          <Dialog open={newViewOpen} onOpenChange={setNewViewOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="h-4 w-4" /> Nueva vista
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nueva vista de respuesta</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="view-name">Nombre</Label>
                  <Input id="view-name" value={newViewName} onChange={(e) => setNewViewName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="view-kind">Tipo</Label>
                  <Select id="view-kind" value={newViewKind} onChange={(e) => setNewViewKind(e.target.value)}>
                    <option value="EXECUTIVE">Ejecutiva</option>
                    <option value="OPERATIVE">Operativa</option>
                    <option value="TECHNICAL">Técnica</option>
                    <option value="CUSTOM">Personalizada</option>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  disabled={!newViewName}
                  onClick={async () => {
                    const res = await createView.mutateAsync({
                      name: newViewName,
                      kind: newViewKind,
                      isDefault: false,
                      configuration: { fields: [] },
                    });
                    setSelectedViewId(res.view.id);
                    setNewViewOpen(false);
                    setNewViewName("");
                  }}
                >
                  Crear
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {loadingViews ? (
        <Skeleton className="h-96" />
      ) : !views || views.length === 0 ? (
        <EmptyState title="No hay vistas de respuesta" description="Crea la primera con el botón de arriba." />
      ) : (
        <div className="grid grid-cols-[280px_1fr] gap-6">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="view-select">Vista</Label>
              <Select id="view-select" value={selectedViewId ?? ""} onChange={(e) => setSelectedViewId(e.target.value)}>
                {views.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </Select>
              {selectedView ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={async () => {
                    if (!window.confirm(`¿Eliminar la vista "${selectedView.name}"?`)) return;
                    await deleteView.mutateAsync(selectedView.id);
                    setSelectedViewId(undefined);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" /> Eliminar vista
                </Button>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sample-select">Datos de ejemplo</Label>
              <Select id="sample-select" value={sampleExecutionId ?? ""} onChange={(e) => setSampleExecutionId(e.target.value)}>
                {executions.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.processName}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Árbol de campos (haz clic en + para agregar)
              </p>
              <div className="max-h-[32rem] overflow-y-auto rounded-md border border-border p-2">
                {sampleExecution?.normalized ? (
                  <JsonTree data={sampleExecution.normalized} onAddPath={addField} />
                ) : (
                  <p className="text-xs text-muted-foreground">Selecciona una validación con datos para explorar su estructura.</p>
                )}
              </div>
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold">{selectedView?.name}</p>
              <Button size="sm" onClick={handleSave} disabled={updateView.isPending}>
                <Save className="h-3.5 w-3.5" /> Guardar cambios
              </Button>
            </div>
            {fields.length === 0 ? (
              <EmptyState title="Sin campos configurados" description="Agrega campos desde el árbol de la izquierda." />
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {fields.map((field) => (
                      <FieldRow
                        key={field.id}
                        field={field}
                        onChange={(next) => setFields((prev) => prev.map((f) => (f.id === field.id ? next : f)))}
                        onRemove={() => setFields((prev) => prev.filter((f) => f.id !== field.id))}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

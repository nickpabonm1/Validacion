import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Trash2, FlaskConical } from "lucide-react";
import { getStepCatalogEntry } from "@fad-console/shared-types";
import { cn } from "@fad-console/ui";
import { Switch } from "../components/ui/switch";
import { Button } from "../components/ui/button";
import { EmptyState } from "../components/ui/misc";
import type { BuilderConfig } from "./types";

interface StepCanvasProps {
  orderedStepKeys: string[];
  steps: BuilderConfig["steps"];
  selectedStepKey: string | null;
  onSelect: (stepKey: string) => void;
  onToggleShow: (stepKey: string) => void;
  onRemove: (stepKey: string) => void;
  onReorder: (orderedKeys: string[]) => void;
}

function CanvasItem({
  stepKey,
  order,
  show,
  selected,
  onSelect,
  onToggleShow,
  onRemove,
}: {
  stepKey: string;
  order: number;
  show: boolean;
  selected: boolean;
  onSelect: () => void;
  onToggleShow: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stepKey });
  const entry = getStepCatalogEntry(stepKey);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex items-center gap-2 rounded-lg border bg-card p-3",
        selected ? "border-primary ring-1 ring-primary" : "border-border",
        isDragging && "opacity-60",
        !show && "opacity-60",
      )}
    >
      <button
        type="button"
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
        aria-label="Arrastrar para reordenar"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <button type="button" onClick={onSelect} className="min-w-0 flex-1 text-left">
        <div className="flex items-center gap-1.5">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
            {order}
          </span>
          <span className="truncate text-sm font-medium">{entry?.label ?? stepKey}</span>
          {entry?.experimental ? <FlaskConical className="h-3.5 w-3.5 shrink-0 text-warning" /> : null}
        </div>
      </button>

      <Switch checked={show} onCheckedChange={onToggleShow} aria-label={`Mostrar paso ${entry?.label ?? stepKey}`} />
      <Button variant="ghost" size="icon" aria-label="Eliminar paso" onClick={onRemove}>
        <Trash2 className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
}

export function StepCanvas({
  orderedStepKeys,
  steps,
  selectedStepKey,
  onSelect,
  onToggleShow,
  onRemove,
  onReorder,
}: StepCanvasProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = orderedStepKeys.indexOf(String(active.id));
    const newIndex = orderedStepKeys.indexOf(String(over.id));
    onReorder(arrayMove(orderedStepKeys, oldIndex, newIndex));
  }

  if (orderedStepKeys.length === 0) {
    return (
      <EmptyState
        title="Todavía no hay pasos"
        description="Agrega pasos desde el catálogo de la izquierda para comenzar a construir el proceso."
      />
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={orderedStepKeys} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {orderedStepKeys.map((stepKey) => (
            <CanvasItem
              key={stepKey}
              stepKey={stepKey}
              order={steps[stepKey]?.order ?? 0}
              show={steps[stepKey]?.show ?? true}
              selected={selectedStepKey === stepKey}
              onSelect={() => onSelect(stepKey)}
              onToggleShow={() => onToggleShow(stepKey)}
              onRemove={() => onRemove(stepKey)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

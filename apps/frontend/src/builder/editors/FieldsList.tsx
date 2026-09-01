import { useState } from "react";
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
import { GripVertical, ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { cn } from "@fad-console/ui";
import { Input } from "../../components/ui/input";
import { Select } from "../../components/ui/select";
import { Checkbox } from "../../components/ui/checkbox";
import { Button } from "../../components/ui/button";

interface FieldRow {
  id: string;
  inputType: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  replaceValue?: boolean;
  value?: string;
  order: number;
  visible?: boolean;
}

function Row({
  field,
  dndId,
  inputTypes,
  onChange,
  onRemove,
}: {
  field: FieldRow;
  dndId: string;
  inputTypes: readonly string[];
  onChange: (field: FieldRow) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: dndId });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("rounded-md border border-border bg-card p-2", isDragging && "opacity-60")}
    >
      <div className="flex items-center gap-2">
        <button type="button" className="cursor-grab text-muted-foreground active:cursor-grabbing" {...attributes} {...listeners}>
          <GripVertical className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => setExpanded((v) => !v)} className="text-muted-foreground">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <Input
          placeholder="id"
          value={field.id}
          onChange={(e) => onChange({ ...field, id: e.target.value })}
          className="h-8 flex-1 text-xs"
        />
        <Input
          placeholder="Etiqueta"
          value={field.label}
          onChange={(e) => onChange({ ...field, label: e.target.value })}
          className="h-8 flex-1 text-xs"
        />
        <Select
          value={field.inputType}
          onChange={(e) => onChange({ ...field, inputType: e.target.value })}
          className="h-8 w-36 text-xs"
        >
          {inputTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
        <label className="flex items-center gap-1 text-xs">
          <Checkbox checked={Boolean(field.required)} onCheckedChange={(v) => onChange({ ...field, required: v === true })} />
          Requerido
        </label>
        <Button variant="ghost" size="icon" aria-label="Eliminar campo" onClick={onRemove}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>
      {expanded ? (
        <div className="mt-2 grid grid-cols-3 gap-2 pl-8">
          <Input
            placeholder="Placeholder"
            value={field.placeholder ?? ""}
            onChange={(e) => onChange({ ...field, placeholder: e.target.value })}
            className="h-8 text-xs"
          />
          <Input
            placeholder="Valor / etiqueta OCR"
            value={field.value ?? ""}
            onChange={(e) => onChange({ ...field, value: e.target.value })}
            className="h-8 text-xs"
          />
          <label className="flex items-center gap-1 text-xs">
            <Checkbox
              checked={Boolean(field.replaceValue)}
              onCheckedChange={(v) => onChange({ ...field, replaceValue: v === true })}
            />
            Reemplazar valor OCR
          </label>
        </div>
      ) : null}
    </div>
  );
}

export function FieldsList({
  fields,
  onChange,
  inputTypes,
}: {
  fields: Array<Record<string, unknown>>;
  onChange: (fields: Array<Record<string, unknown>>) => void;
  inputTypes: readonly string[];
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const ids = fields.map((_, i) => `field-${i}`);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    onChange(arrayMove(fields, oldIndex, newIndex).map((f, i) => ({ ...f, order: i })));
  }

  if (fields.length === 0) {
    return <p className="text-xs text-muted-foreground">Sin campos todavía.</p>;
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <div className="space-y-1.5">
          {fields.map((field, index) => (
            <Row
              key={ids[index]}
              dndId={ids[index]!}
              field={field as unknown as FieldRow}
              inputTypes={inputTypes}
              onChange={(next) => onChange(fields.map((f, i) => (i === index ? (next as unknown as Record<string, unknown>) : f)))}
              onRemove={() => onChange(fields.filter((_, i) => i !== index))}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

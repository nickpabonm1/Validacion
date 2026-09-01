import { useState } from "react";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { Button } from "../ui/button";

interface JsonTreeProps {
  data: unknown;
  path?: string;
  onAddPath: (path: string, sampleValue: unknown) => void;
  depth?: number;
}

function inferLabel(path: string): string {
  const segments = path.split(".");
  return segments[segments.length - 1] ?? path;
}

export function JsonTree({ data, path = "", onAddPath, depth = 0 }: JsonTreeProps) {
  const [collapsed, setCollapsed] = useState(depth > 1);

  if (data === null || data === undefined) {
    return (
      <Leaf path={path} value={data} onAdd={onAddPath} />
    );
  }

  if (Array.isArray(data)) {
    return (
      <div style={{ marginLeft: depth > 0 ? 14 : 0 }}>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setCollapsed((v) => !v)} className="text-muted-foreground">
            {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          <span className="font-mono text-xs text-muted-foreground">
            {inferLabel(path) || "raíz"} [{data.length}]
          </span>
          {path ? (
            <Button variant="ghost" size="icon" className="h-5 w-5" aria-label={`Agregar ${path}`} onClick={() => onAddPath(path, data)}>
              <Plus className="h-3 w-3" />
            </Button>
          ) : null}
        </div>
        {!collapsed && data.length > 0 ? (
          <JsonTree data={data[0]} path={`${path}.0`} onAddPath={onAddPath} depth={depth + 1} />
        ) : null}
      </div>
    );
  }

  if (typeof data === "object") {
    const entries = Object.entries(data as Record<string, unknown>);
    return (
      <div style={{ marginLeft: depth > 0 ? 14 : 0 }}>
        {path ? (
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setCollapsed((v) => !v)} className="text-muted-foreground">
              {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
            <span className="font-mono text-xs">{inferLabel(path)}</span>
            <Button variant="ghost" size="icon" className="h-5 w-5" aria-label={`Agregar ${path}`} onClick={() => onAddPath(path, data)}>
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        ) : null}
        {!collapsed
          ? entries.map(([key, value]) => (
              <JsonTree key={key} data={value} path={path ? `${path}.${key}` : key} onAddPath={onAddPath} depth={depth + 1} />
            ))
          : null}
      </div>
    );
  }

  return <Leaf path={path} value={data} onAdd={onAddPath} depth={depth} />;
}

function Leaf({ path, value, onAdd, depth = 1 }: { path: string; value: unknown; onAdd: (p: string, v: unknown) => void; depth?: number }) {
  return (
    <div className="flex items-center gap-1.5 py-0.5" style={{ marginLeft: depth > 0 ? 14 : 0 }}>
      <span className="font-mono text-xs">{inferLabel(path)}:</span>
      <span className="truncate text-xs text-muted-foreground">{JSON.stringify(value)}</span>
      <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" aria-label={`Agregar campo ${path}`} onClick={() => onAdd(path, value)}>
        <Plus className="h-3 w-3" />
      </Button>
    </div>
  );
}

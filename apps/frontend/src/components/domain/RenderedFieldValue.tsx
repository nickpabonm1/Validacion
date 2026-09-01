import type { RenderedField } from "../../features/response-views/useResponseViews";
import { Badge } from "../ui/badge";

function formatDate(value: unknown, withTime: boolean): string {
  if (typeof value !== "string" && typeof value !== "number") return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return withTime ? date.toLocaleString() : date.toLocaleDateString();
}

export function RenderedFieldValue({ field }: { field: RenderedField }) {
  const { value, renderType } = field;

  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground">—</span>;
  }

  switch (renderType) {
    case "BOOLEAN":
      return <Badge tone={value ? "success" : "neutral"}>{value ? "Sí" : "No"}</Badge>;
    case "STATUS":
    case "BADGE":
      return <Badge tone="info">{String(value)}</Badge>;
    case "PERCENTAGE":
      return <span>{Number(value).toFixed(2)}%</span>;
    case "NUMBER":
      return <span className="tabular-nums">{String(value)}</span>;
    case "DATE":
      return <span>{formatDate(value, false)}</span>;
    case "DATETIME":
      return <span>{formatDate(value, true)}</span>;
    case "MASKED":
      return <span className="font-mono">{String(value)}</span>;
    case "LINK":
      return (
        <a href={String(value)} target="_blank" rel="noreferrer" className="text-primary underline">
          {String(value)}
        </a>
      );
    case "IMAGE":
      return <img src={String(value)} alt={field.label} className="max-h-24 rounded border border-border" />;
    case "COORDINATES": {
      const coords = value as { latitude?: string | null; longitude?: string | null };
      return (
        <span className="font-mono text-xs">
          {coords.latitude ?? "?"}, {coords.longitude ?? "?"}
        </span>
      );
    }
    case "LIST":
      return Array.isArray(value) ? (
        <ul className="list-inside list-disc text-sm">
          {value.map((item, i) => (
            <li key={i}>{typeof item === "object" ? JSON.stringify(item) : String(item)}</li>
          ))}
        </ul>
      ) : (
        <span>{String(value)}</span>
      );
    case "TABLE":
      return (
        <div className="max-h-60 overflow-auto rounded border border-border">
          <table className="w-full text-xs">
            <tbody>
              {Object.entries(value as Record<string, unknown>).map(([k, v]) => (
                <tr key={k} className="border-t border-border first:border-t-0">
                  <td className="px-2 py-1 font-medium text-muted-foreground">{k}</td>
                  <td className="px-2 py-1">{typeof v === "object" ? JSON.stringify(v) : String(v)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "JSON":
      return <pre className="max-h-60 overflow-auto rounded bg-muted p-2 text-xs">{JSON.stringify(value, null, 2)}</pre>;
    default:
      return <span>{typeof value === "object" ? JSON.stringify(value) : String(value)}</span>;
  }
}

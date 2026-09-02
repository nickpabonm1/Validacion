import { useMemo, useState } from "react";
import { ArrowUpDown, Check, Copy, Search } from "lucide-react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { useToast } from "../ui/toast";

const LONG_STRING_THRESHOLD = 200;

/** Nunca vuelca un valor largo (probable base64 de una imagen que no se haya extraído a
 * `mediaAssets`) como texto: es la última línea de defensa contra un volcado ilegible, además
 * de la extracción explícita que ya hacen `extractMediaAssets` (API by-steps) y
 * `fad-sdk-client.ts`/`websdk-normalize.ts` (Web SDK). */
function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string" && value.length > LONG_STRING_THRESHOLD) {
    return "[contenido binario — revisa la galería de imágenes]";
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** Tabla clave/valor para datos OCR y similares: búsqueda, ordenamiento y copiar valor
 * (sección 17 del brief). Nunca muestra el objeto como bloque JSON crudo. */
export function OcrTable({ data, title }: { data: Record<string, unknown>; title?: string }) {
  const [search, setSearch] = useState("");
  const [sortAsc, setSortAsc] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const { notify } = useToast();

  const rows = useMemo(() => {
    const entries = Object.entries(data).filter(([, v]) => v !== null && v !== undefined && v !== "");
    const filtered = search
      ? entries.filter(
          ([k, v]) => k.toLowerCase().includes(search.toLowerCase()) || formatValue(v).toLowerCase().includes(search.toLowerCase()),
        )
      : entries;
    return filtered.sort((a, b) => (sortAsc ? a[0].localeCompare(b[0]) : b[0].localeCompare(a[0])));
  }, [data, search, sortAsc]);

  if (Object.keys(data).length === 0) return null;

  return (
    <div>
      {title ? <p className="mb-2 text-sm font-semibold">{title}</p> : null}
      <div className="mb-2 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar campo o valor…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => setSortAsc((v) => !v)}>
          <ArrowUpDown className="h-3.5 w-3.5" /> {sortAsc ? "A–Z" : "Z–A"}
        </Button>
      </div>
      <div className="max-h-80 overflow-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <tbody>
            {rows.map(([key, value]) => (
              <tr key={key} className="border-t border-border first:border-t-0">
                <td className="w-1/3 px-3 py-1.5 align-top text-xs font-medium text-muted-foreground">{key}</td>
                <td className="px-3 py-1.5">{formatValue(value)}</td>
                <td className="w-8 px-2 py-1.5 text-right">
                  <button
                    type="button"
                    aria-label={`Copiar ${key}`}
                    onClick={() => {
                      void navigator.clipboard.writeText(formatValue(value));
                      setCopiedKey(key);
                      notify({ title: "Copiado", tone: "info" });
                      setTimeout(() => setCopiedKey(null), 1200);
                    }}
                  >
                    {copiedKey === key ? (
                      <Check className="h-3.5 w-3.5 text-success" />
                    ) : (
                      <Copy className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                    )}
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-3 py-4 text-center text-xs text-muted-foreground">
                  Sin coincidencias.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

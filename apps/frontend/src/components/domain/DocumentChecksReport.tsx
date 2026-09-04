import { AlertTriangle, CheckCircle2, MinusCircle } from "lucide-react";
import { resultTone, type DocumentCheckTone, type NormalizedDocumentCheck } from "@fad-console/shared-types";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import {
  translateCheckDescription,
  translateCheckName,
  translateResultDescription,
  translateResultLabel,
} from "../../lib/document-check-i18n";
import { DocumentCheckScoreCard } from "./DocumentCheckScoreCard";

/** Orden y etiquetas de las 5 categorías de `steps.captureId.data.alerts`, igual que las
 * secciones que ya muestra el Portal FAD (confirmado con una respuesta real de FAD, no
 * documentado en el PDF ni en la colección Postman). Una categoría no reconocida (ninguna
 * observada hasta ahora) se muestra igual, con su propio nombre técnico como título. */
const CATEGORY_ORDER = [
  "documentValidation",
  "textCrossChecks",
  "imageQuality",
  "mrzCheckDigit",
  "dateChecks",
  "authenticity",
  "naatCheckRecheck",
] as const;
export const CATEGORY_LABELS: Record<string, string> = {
  // Acuant (AssureID) — array plano de tests sin categorías propias, ver validation-detail.ts
  // `pushAcuantDocumentChecks`.
  documentValidation: "Validación de documento",
  textCrossChecks: "Validación de datos cruzados",
  imageQuality: "Calidad de la imagen",
  mrzCheckDigit: "Verificación de dígitos MRZ",
  dateChecks: "Validación de fechas",
  authenticity: "Autenticidad del documento",
  // Fila sintética agregada por `naat-check-merge.ts` cuando se dispara un recheck manual — ver
  // `NaatCheckRecheckPanel`. Vacía (sin filas) hasta que se dispara al menos un recheck.
  naatCheckRecheck: "NAAT-CHECK (reevaluación manual)",
};

const TONE_ORDER: Record<DocumentCheckTone, number> = { warning: 0, muted: 1, success: 2 };

/** Ordena poniendo primero lo que amerita revisión (advertencias), luego lo no realizado, y al
 * final lo correcto — así lo relevante queda visible sin desplazarse por decenas de filas "OK". */
function sortByTone(items: NormalizedDocumentCheck[]): NormalizedDocumentCheck[] {
  return [...items].sort((a, b) => TONE_ORDER[resultTone(a.result)] - TONE_ORDER[resultTone(b.result)]);
}

function ResultIcon({ result }: { result: string }) {
  const tone = resultTone(result);
  if (tone === "success") return <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-label="OK" />;
  if (tone === "muted") return <MinusCircle className="h-4 w-4 shrink-0 text-muted-foreground" aria-label="No realizado" />;
  return <AlertTriangle className="h-4 w-4 shrink-0 text-warning" aria-label="Revisar" />;
}

function ChecksTable({ items }: { items: NormalizedDocumentCheck[] }) {
  const sorted = sortByTone(items);
  return (
    <div className="overflow-hidden rounded-md border border-border">
      <table className="w-full text-sm">
        <tbody>
          {sorted.map((check, index) => {
            const description = translateResultDescription(check.resultDescription);
            const detail = translateCheckDescription(check.description) ?? (check.sources && check.sources.length > 0 ? check.sources.join(" vs ") : null);
            return (
              <tr key={index} className="border-t border-border first:border-t-0 align-top">
                <td className="w-1/3 px-3 py-1.5 text-xs font-medium">{translateCheckName(check.name)}</td>
                <td className="px-3 py-1.5 text-xs text-muted-foreground">{detail ?? "—"}</td>
                <td className="px-3 py-1.5">
                  <div className="flex items-center gap-1.5 text-xs">
                    <ResultIcon result={check.result} />
                    {description ?? translateResultLabel(check.result)}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Cuerpo de la "Validación de ID": agrupa `documentChecks` por categoría y, cuando aplica
 * (autenticidad/calidad de imagen), por página (1 = frente, 2 = reverso), traduciendo al español
 * el vocabulario cerrado confirmado con respuestas reales de FAD (ver `document-check-i18n.ts`) y
 * mostrando primero lo que amerita revisión. Sin el `Card` exterior, para poder incrustarse tanto
 * en el reporte fijo (`DocumentChecksReport`) como en un campo de una vista de respuesta
 * personalizada (`RenderedFieldValue`, `renderType: "DOCUMENT_CHECKS"`).
 */
export function DocumentChecksGroups({ checks = [] }: { checks?: NormalizedDocumentCheck[] }) {
  if (checks.length === 0) return <p className="text-xs text-muted-foreground">Sin datos de validación de documento.</p>;

  const byCategory = new Map<string, NormalizedDocumentCheck[]>();
  for (const check of checks) {
    if (!byCategory.has(check.category)) byCategory.set(check.category, []);
    byCategory.get(check.category)!.push(check);
  }
  const knownCategories = CATEGORY_ORDER.filter((c) => byCategory.has(c));
  const otherCategories = [...byCategory.keys()].filter((c) => !(CATEGORY_ORDER as readonly string[]).includes(c));
  const categories = [...knownCategories, ...otherCategories];

  return (
    <div className="space-y-6">
      <DocumentCheckScoreCard checks={checks} />
      {categories.map((category) => {
        const items = byCategory.get(category)!;
        const warningCount = items.filter((i) => resultTone(i.result) === "warning").length;
        const pages = [...new Set(items.map((i) => i.page))];
        const hasPages = pages.some((p) => p !== null);
        return (
          <div key={category}>
            <div className="mb-2 flex items-center gap-2">
              <p className="text-sm font-semibold">{CATEGORY_LABELS[category] ?? category}</p>
              {warningCount > 0 ? (
                <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-warning">
                  {warningCount} para revisar
                </span>
              ) : null}
            </div>
            {hasPages ? (
              <div className="space-y-3">
                {pages
                  .filter((p): p is number => p !== null)
                  .sort((a, b) => a - b)
                  .map((page) => (
                    <div key={page}>
                      <p className="mb-1 text-xs font-medium text-muted-foreground">Página {page}</p>
                      <ChecksTable items={items.filter((i) => i.page === page)} />
                    </div>
                  ))}
              </div>
            ) : (
              <ChecksTable items={items} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Reporte de "Validación de ID" del paso `captureId` (datos cruzados, autenticidad, calidad de
 * imagen, MRZ, fechas) — replica las mismas secciones que ya muestra el Portal FAD.
 */
export function DocumentChecksReport({ checks = [] }: { checks?: NormalizedDocumentCheck[] }) {
  if (checks.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Validación de ID</CardTitle>
      </CardHeader>
      <CardContent>
        <DocumentChecksGroups checks={checks} />
      </CardContent>
    </Card>
  );
}

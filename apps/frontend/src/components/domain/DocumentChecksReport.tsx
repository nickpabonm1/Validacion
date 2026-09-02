import { AlertTriangle, CheckCircle2, MinusCircle } from "lucide-react";
import type { NormalizedDocumentCheck } from "@fad-console/shared-types";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

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
] as const;
const CATEGORY_LABELS: Record<string, string> = {
  // Acuant (AssureID) — array plano de tests sin categorías propias, ver validation-detail.ts
  // `pushAcuantDocumentChecks`.
  documentValidation: "Validación de documento",
  textCrossChecks: "Validación de datos cruzados",
  imageQuality: "Calidad de la imagen",
  mrzCheckDigit: "Verificación de dígitos MRZ",
  dateChecks: "Validación de fechas",
  authenticity: "Autenticidad del documento",
};

/** `result` observados hasta ahora: "OK" (positivo) y "WAS_NOT_DONE" (no se ejecutó — neutral,
 * no es necesariamente un problema). Cualquier otro valor se trata como advertencia: FAD no ha
 * devuelto ningún otro nombre en las respuestas reales revisadas, así que no se asume que sea un
 * error grave, solo que amerita revisión. */
function resultTone(result: string): "success" | "muted" | "warning" {
  if (result === "OK") return "success";
  if (result === "WAS_NOT_DONE") return "muted";
  return "warning";
}

function ResultIcon({ result }: { result: string }) {
  const tone = resultTone(result);
  if (tone === "success") return <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-label="OK" />;
  if (tone === "muted") return <MinusCircle className="h-4 w-4 shrink-0 text-muted-foreground" aria-label="No realizado" />;
  return <AlertTriangle className="h-4 w-4 shrink-0 text-warning" aria-label="Revisar" />;
}

function ChecksTable({ items }: { items: NormalizedDocumentCheck[] }) {
  return (
    <div className="overflow-hidden rounded-md border border-border">
      <table className="w-full text-sm">
        <tbody>
          {items.map((check, index) => {
            const detail = check.description ?? (check.sources && check.sources.length > 0 ? check.sources.join(" vs ") : null);
            return (
              <tr key={index} className="border-t border-border first:border-t-0 align-top">
                <td className="w-1/3 px-3 py-1.5 text-xs font-medium">{check.name}</td>
                <td className="px-3 py-1.5 text-xs text-muted-foreground">{detail ?? "—"}</td>
                <td className="px-3 py-1.5">
                  <div className="flex items-center gap-1.5 text-xs">
                    <ResultIcon result={check.result} />
                    {check.resultDescription ?? check.result}
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
 * Reporte de "Validación de ID" del paso `captureId` (datos cruzados, autenticidad, calidad de
 * imagen, MRZ, fechas) — replica las mismas secciones que ya muestra el Portal FAD, agrupando
 * `documentChecks` por categoría y, cuando aplica (autenticidad/calidad de imagen), por
 * página (1 = frente, 2 = reverso).
 */
export function DocumentChecksReport({ checks }: { checks: NormalizedDocumentCheck[] }) {
  if (checks.length === 0) return null;

  const byCategory = new Map<string, NormalizedDocumentCheck[]>();
  for (const check of checks) {
    if (!byCategory.has(check.category)) byCategory.set(check.category, []);
    byCategory.get(check.category)!.push(check);
  }
  const knownCategories = CATEGORY_ORDER.filter((c) => byCategory.has(c));
  const otherCategories = [...byCategory.keys()].filter((c) => !(CATEGORY_ORDER as readonly string[]).includes(c));
  const categories = [...knownCategories, ...otherCategories];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Validación de ID</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {categories.map((category) => {
          const items = byCategory.get(category)!;
          const pages = [...new Set(items.map((i) => i.page))];
          const hasPages = pages.some((p) => p !== null);
          return (
            <div key={category}>
              <p className="mb-2 text-sm font-semibold">{CATEGORY_LABELS[category] ?? category}</p>
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
      </CardContent>
    </Card>
  );
}

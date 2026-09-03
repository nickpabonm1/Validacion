import type { DocumentCheckScore, NormalizedDocumentCheck } from "@fad-console/shared-types";

export type DocumentCheckTone = "success" | "muted" | "warning";

/** `result` observados hasta ahora: "OK" (positivo) y "WAS_NOT_DONE" (no se ejecutó — neutral,
 * no es necesariamente un problema). Cualquier otro valor se trata como advertencia: FAD no ha
 * devuelto ningún otro nombre en las respuestas reales revisadas, así que no se asume que sea un
 * error grave, solo que amerita revisión. */
export function resultTone(result: string): DocumentCheckTone {
  if (result === "OK") return "success";
  if (result === "WAS_NOT_DONE") return "muted";
  return "warning";
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Puntúa `documentChecks` según un peso por categoría (una categoría sin peso configurado pesa 1
 * — ponderación neutra, es decir, cuenta simple de aciertos) y calcula un porcentaje y un
 * veredicto opcional contra `passThreshold`. Los checks con resultado "WAS_NOT_DONE" (FAD indica
 * explícitamente que no se evaluaron) se excluyen del cálculo: ni suman como acierto ni como
 * fallo, para no fabricar un juicio sobre algo que no se evaluó. El peso y el umbral son una
 * decisión de negocio del operador (`DocumentCheckScoringConfigDto`), nunca algo que este cálculo
 * decida por su cuenta.
 */
export function computeDocumentCheckScore(
  checks: NormalizedDocumentCheck[],
  categoryWeights: Record<string, number>,
  passThreshold: number | null,
): DocumentCheckScore {
  const byCategory = new Map<string, { totalWeight: number; achievedWeight: number }>();
  let totalWeight = 0;
  let achievedWeight = 0;
  let evaluatedCount = 0;
  let skippedCount = 0;

  for (const check of checks) {
    const tone = resultTone(check.result);
    if (tone === "muted") {
      skippedCount += 1;
      continue;
    }
    evaluatedCount += 1;
    const weight = categoryWeights[check.category] ?? 1;
    const achieved = tone === "success" ? weight : 0;

    totalWeight += weight;
    achievedWeight += achieved;

    const bucket = byCategory.get(check.category) ?? { totalWeight: 0, achievedWeight: 0 };
    bucket.totalWeight += weight;
    bucket.achievedWeight += achieved;
    byCategory.set(check.category, bucket);
  }

  const percentage = totalWeight > 0 ? round1((achievedWeight / totalWeight) * 100) : null;
  const passed = percentage === null || passThreshold === null ? null : percentage >= passThreshold;

  return {
    totalWeight,
    achievedWeight,
    percentage,
    evaluatedCount,
    skippedCount,
    passed,
    byCategory: [...byCategory.entries()].map(([category, w]) => ({
      category,
      totalWeight: w.totalWeight,
      achievedWeight: w.achievedWeight,
      percentage: w.totalWeight > 0 ? round1((w.achievedWeight / w.totalWeight) * 100) : null,
    })),
  };
}

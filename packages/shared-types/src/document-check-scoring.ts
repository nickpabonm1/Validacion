import type { NormalizedDocumentCheck } from "./normalized";

/**
 * Configuración de puntuación de `documentChecks` (Validación de ID del paso `captureId`): peso
 * relativo por categoría y umbral de aprobación. Es una decisión de negocio del operador, nunca
 * algo que FAD indique — por eso es configurable en vez de estar codificado (ver
 * `document-check-scoring` en el backend, la página "Configuración de la respuesta" en el
 * frontend, y `computeDocumentCheckScore` más abajo). Cuando `passThreshold` está configurado, el
 * backend también lo aplica para RECHAZAR automáticamente el proceso (ver
 * `NormalizedValidationDetail.documentCheckRejection` y `executions.service.ts`), no solo para
 * mostrar un veredicto en el reporte.
 */
export interface DocumentCheckScoringConfigDto {
  /** Peso por categoría (`textCrossChecks`, `imageQuality`, `mrzCheckDigit`, `dateChecks`,
   * `authenticity`, `documentValidation`). Una categoría ausente pesa 1 (peso neutro, comportamiento
   * histórico). Cuando se usa como "Prioridad de calificación por categoría" (porcentaje 1-100), las
   * categorías activas (peso > 0) deben sumar 100 — validado en `DocumentCheckScoringConfigInputSchema`,
   * no aquí (esta función pura acepta cualquier número, solo pondera). */
  categoryWeights: Record<string, number>;
  /** Subpeso por característica (`check.name`) DENTRO de cada categoría — `featureWeights[category][name]`,
   * porcentaje 1-100. Cuando una categoría NO tiene entrada aquí, cada una de sus características pesa
   * 100 (el peso de la categoría se reparte completo, igual que antes de que existieran subpesos).
   * Cuando una categoría SÍ tiene entrada, una característica ausente de ese mapa pesa 0 (el operador
   * definió una repartición explícita y completa; algo fuera de ella no debe sumar puntos por sorpresa).
   * Los subpesos de las características listadas de una misma categoría deben sumar 100. */
  featureWeights: Record<string, Record<string, number>>;
  /** Porcentaje mínimo (0-100) para considerar la validación de documento "aprobada". `null` =
   * sin umbral configurado — el reporte solo muestra el porcentaje, sin veredicto. */
  passThreshold: number | null;
  /** `false` (por defecto): un check "WAS_NOT_DONE" (el proveedor no lo ejecutó) no cuenta ni
   * como acierto ni como fallo — queda fuera del porcentaje. `true`: lo cuenta como fallo (resta
   * al porcentaje) — decisión de negocio explícita para instalaciones donde un check no
   * ejecutado se considera falta de concordancia documental, no un dato simplemente ausente. Ver
   * `computeDocumentCheckScore`. */
  treatNotDoneAsFailure: boolean;
  updatedAt: string;
}

/** Resultado de puntuar `documentChecks` con un `DocumentCheckScoringConfigDto`. Por defecto, los
 * checks con resultado "WAS_NOT_DONE" (no evaluados por FAD) se excluyen tanto del numerador como
 * del denominador — nunca se asume que "no evaluado" equivalga a correcto o incorrecto, salvo que
 * `treatNotDoneAsFailure` esté activo. */
export interface DocumentCheckScore {
  totalWeight: number;
  achievedWeight: number;
  percentage: number | null;
  evaluatedCount: number;
  skippedCount: number;
  passed: boolean | null;
  byCategory: Array<{
    category: string;
    totalWeight: number;
    achievedWeight: number;
    percentage: number | null;
  }>;
}

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
 * veredicto opcional contra `passThreshold`. Por defecto (`treatNotDoneAsFailure: false`), los
 * checks con resultado "WAS_NOT_DONE" (FAD indica explícitamente que no se evaluaron) se excluyen
 * del cálculo: ni suman como acierto ni como fallo. Con `treatNotDoneAsFailure: true`, esos mismos
 * checks SÍ restan al porcentaje (cuentan como fallo) — una decisión de negocio explícita, nunca
 * el comportamiento por defecto. `evaluatedCount`/`skippedCount` siempre reflejan lo que FAD
 * realmente evaluó o no, sin importar esta bandera — es información sobre el proveedor, no sobre
 * la política de puntuación. El peso de cada check es compuesto: peso de su categoría × (subpeso de
 * su característica / 100) — ver `resolveFeatureWeight`. El peso, el subpeso y el umbral son una
 * decisión de negocio del operador (`DocumentCheckScoringConfigDto`), nunca algo que este cálculo
 * decida por su cuenta. Usada tanto
 * por el frontend (reporte, vista previa en vivo) como por el backend (`executions.service.ts`,
 * para decidir el rechazo automático).
 */
/** Subpeso (0-100) de una característica dentro de su categoría. Ver el comentario de
 * `featureWeights` en `DocumentCheckScoringConfigDto` para la lógica del valor por defecto. */
function resolveFeatureWeight(
  category: string,
  name: string,
  featureWeights: Record<string, Record<string, number>>,
): number {
  const configured = featureWeights[category];
  if (!configured) return 100;
  return configured[name] ?? 0;
}

export function computeDocumentCheckScore(
  checks: NormalizedDocumentCheck[],
  categoryWeights: Record<string, number>,
  passThreshold: number | null,
  treatNotDoneAsFailure = false,
  featureWeights: Record<string, Record<string, number>> = {},
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
      if (!treatNotDoneAsFailure) continue;
    } else {
      evaluatedCount += 1;
    }
    const categoryWeight = categoryWeights[check.category] ?? 1;
    const featureWeight = resolveFeatureWeight(check.category, check.name, featureWeights);
    const weight = categoryWeight * (featureWeight / 100);
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

import { z } from "zod";

const WEIGHT_SUM_TOLERANCE = 0.5;

/**
 * Peso relativo por categoría, subpeso relativo por característica dentro de cada categoría, y
 * umbral de aprobación para puntuar `documentChecks` (ver `DocumentCheckScoringConfigDto` en
 * shared-types). Los nombres de categoría/característica no se restringen a una lista cerrada: una
 * categoría o característica nueva que FAD/otro proveedor exponga en el futuro puede configurarse
 * igual sin requerir un cambio de esquema.
 *
 * Validación cruzada ("Prioridad de calificación por categoría"): las categorías ACTIVAS (peso >
 * 0) deben sumar 100%, y dentro de cada categoría con subpesos configurados, esos subpesos también
 * deben sumar 100% — con una tolerancia de redondeo de ±0.5 puntos.
 */
export const DocumentCheckScoringConfigInputSchema = z
  .object({
    categoryWeights: z.record(z.number().min(0).max(100)).default({}),
    /** `featureWeights[category][featureName]` — ver el comentario en `DocumentCheckScoringConfigDto`. */
    featureWeights: z.record(z.record(z.number().min(0).max(100))).default({}),
    passThreshold: z.number().min(0).max(100).nullable(),
    treatNotDoneAsFailure: z.boolean().default(false),
  })
  .superRefine((value, ctx) => {
    const activeCategoryWeights = Object.entries(value.categoryWeights).filter(([, weight]) => weight > 0);
    if (activeCategoryWeights.length > 0) {
      const total = activeCategoryWeights.reduce((sum, [, weight]) => sum + weight, 0);
      if (Math.abs(total - 100) > WEIGHT_SUM_TOLERANCE) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["categoryWeights"],
          message: `La suma de los pesos de las categorías activas debe ser 100% (actualmente ${Math.round(total * 10) / 10}%).`,
        });
      }
    }

    for (const [category, featureWeightsForCategory] of Object.entries(value.featureWeights)) {
      const entries = Object.entries(featureWeightsForCategory);
      if (entries.length === 0) continue;
      const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
      if (Math.abs(total - 100) > WEIGHT_SUM_TOLERANCE) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["featureWeights", category],
          message: `La suma de los subpesos de las características de "${category}" debe ser 100% (actualmente ${Math.round(total * 10) / 10}%).`,
        });
      }
    }
  });
export type DocumentCheckScoringConfigInput = z.infer<typeof DocumentCheckScoringConfigInputSchema>;

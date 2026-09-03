import { z } from "zod";

/**
 * Peso relativo por categoría y umbral de aprobación para puntuar `documentChecks` (ver
 * `DocumentCheckScoringConfigDto` en shared-types). Los nombres de categoría no se restringen a
 * una lista cerrada: una categoría nueva que FAD/otro proveedor exponga en el futuro puede
 * configurarse igual sin requerir un cambio de esquema.
 */
export const DocumentCheckScoringConfigInputSchema = z.object({
  categoryWeights: z.record(z.number().min(0).max(100)).default({}),
  passThreshold: z.number().min(0).max(100).nullable(),
});
export type DocumentCheckScoringConfigInput = z.infer<typeof DocumentCheckScoringConfigInputSchema>;

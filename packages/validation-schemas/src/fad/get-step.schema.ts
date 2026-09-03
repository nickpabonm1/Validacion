import { z } from "zod";

/** {método configurable} {baseUrl}/validation/getValidationStep/{validationId}. Documentado
 * como POST, comprobado como GET en la colección Postman UATHA (ver docs/api-contracts.md). La
 * respuesta trae muchos campos dinámicos por tipo de paso: se usa passthrough en todos los
 * niveles para no descartar información no documentada (sección 7.3 / 30.7 del brief).
 *
 * Confirmado con una respuesta real de FAD (log de sincronización compartido por el operador):
 * junto a los pasos reales de la validación, `steps` también trae entradas administrativas sin
 * iniciar (p. ej. `instructionsPermissions`, `processCompleted`) donde `status`/`configuration`/
 * `features` vienen explícitamente `null` (no ausentes) — con estos campos como `.optional()`
 * (que solo acepta `undefined`, no `null`) Zod rechazaba la respuesta COMPLETA por ese único
 * detalle, descartando también los pasos reales que sí traían `status: "COMPLETED"` en el mismo
 * cuerpo. Se aceptan como `.nullable()` en todos los niveles por la misma razón: FAD envía `null`
 * liberalmente en este endpoint. */
const StepInfoSchema = z
  .object({
    order: z.number().nullable().optional(),
    status: z.string().nullable().optional(),
    show: z.boolean().nullable().optional(),
    configuration: z.record(z.unknown()).nullable().optional(),
    features: z.record(z.unknown()).nullable().optional(),
    data: z.unknown().nullable().optional(),
  })
  .passthrough();

export const GetValidationStepResponseSchema = z
  .object({
    success: z.boolean(),
    error: z.string().nullable().optional(),
    code: z.number().nullable().optional(),
    data: z
      .object({
        processName: z.string().nullable().optional(),
        validation: z
          .object({
            idProcess: z.string().nullable().optional(),
            status: z.string().nullable().optional(),
          })
          .passthrough()
          .optional(),
        client: z
          .object({
            name: z.string().nullable().optional(),
            mail: z.string().nullable().optional(),
            phone: z.string().nullable().optional(),
          })
          .passthrough()
          .optional(),
        steps: z.record(StepInfoSchema).optional(),
        validationKeys: z
          .object({
            key: z.string().optional(),
            vector: z.string().optional(),
            validationId: z.string().optional(),
          })
          .passthrough()
          .optional(),
      })
      .passthrough()
      .nullable(),
  })
  .passthrough();
export type GetValidationStepResponse = z.infer<typeof GetValidationStepResponseSchema>;

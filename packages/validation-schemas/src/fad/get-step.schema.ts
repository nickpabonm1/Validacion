import { z } from "zod";

/** {método configurable} {baseUrl}/validation/getValidationStep/{validationId}. Documentado
 * como POST, comprobado como GET en la colección Postman UATHA (ver docs/api-contracts.md). La
 * respuesta trae muchos campos dinámicos por tipo de paso: se usa passthrough en todos los
 * niveles para no descartar información no documentada (sección 7.3 / 30.7 del brief). */
const StepInfoSchema = z
  .object({
    order: z.number().optional(),
    status: z.string().optional(),
    show: z.boolean().optional(),
    configuration: z.record(z.unknown()).optional(),
    features: z.record(z.unknown()).optional(),
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
        processName: z.string().optional(),
        validation: z
          .object({
            idProcess: z.string().optional(),
            status: z.string().optional(),
          })
          .passthrough()
          .optional(),
        client: z
          .object({
            name: z.string().optional(),
            mail: z.string().optional(),
            phone: z.string().optional(),
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

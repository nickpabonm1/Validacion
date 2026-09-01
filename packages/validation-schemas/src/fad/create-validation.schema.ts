import { z } from "zod";

/** POST {baseUrl}/biometrics-by-steps/validations — respuesta documentada. */
export const CreateValidationResponseSchema = z
  .object({
    success: z.boolean(),
    error: z.string().nullable().optional(),
    code: z.number().nullable().optional(),
    data: z
      .object({
        key: z.string(),
        vector: z.string(),
        validationId: z.string(),
      })
      .nullable(),
  })
  .passthrough();
export type CreateValidationResponse = z.infer<typeof CreateValidationResponseSchema>;

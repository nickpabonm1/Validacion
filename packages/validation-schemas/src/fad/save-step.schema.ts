import { z } from "zod";

/** Body enviado a POST {baseUrl}/validation/saveValidationStep/{validationId}: el string
 * cifrado AES/CBC/PKCS5Padding generado por el SDK oficial de captura biométrica. Esta consola
 * no genera ni simula el cifrado; solo reenvía un payload ya cifrado provisto por el llamador. */
export const SaveValidationStepRequestSchema = z.object({
  validationId: z.string().min(1, "validationId es obligatorio"),
  encryptedPayload: z.string().min(1, "El payload cifrado es obligatorio"),
  stepKey: z.string().min(1).optional(),
});
export type SaveValidationStepRequest = z.infer<typeof SaveValidationStepRequestSchema>;

export const SaveValidationStepResponseSchema = z
  .object({
    success: z.boolean(),
    error: z.string().nullable().optional(),
    code: z.number().nullable().optional(),
    data: z
      .object({
        validationId: z.string(),
      })
      .nullable(),
  })
  .passthrough();
export type SaveValidationStepResponse = z.infer<typeof SaveValidationStepResponseSchema>;

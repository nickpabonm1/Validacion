import { z } from "zod";

/** POST {baseUrl}/validation/validations/getValidationData/{validationId}. Respuesta con
 * decenas de campos opcionales y dinámicos (sección 2.5 del PDF / 7.4 y 30.7 del brief). Se
 * modelan solo los campos documentados con más certeza y se deja `passthrough` para todo lo
 * demás: nunca se descarta un campo desconocido ni se asume que todos existen. */
export const GetValidationDataResponseSchema = z
  .object({
    success: z.boolean(),
    error: z.union([z.string(), z.null()]).optional(),
    code: z.number().nullable().optional(),
    data: z
      .object({
        client: z.record(z.unknown()).nullable().optional(),
        face: z.record(z.unknown()).nullable().optional(),
        deviceInfo: z.record(z.unknown()).nullable().optional(),
        networkInfo: z.record(z.unknown()).nullable().optional(),
        fingerprints: z.array(z.unknown()).nullable().optional(),
        pageDetail: z.array(z.unknown()).nullable().optional(),
        latitude: z.union([z.string(), z.number()]).nullable().optional(),
        longitude: z.union([z.string(), z.number()]).nullable().optional(),
        companyId: z.string().nullable().optional(),
        status: z.string().nullable().optional(),
        startDate: z.string().nullable().optional(),
        endDate: z.string().nullable().optional(),
        userId: z.string().nullable().optional(),
        idValidation: z.string().nullable().optional(),
        porcentCompare: z.union([z.string(), z.number()]).nullable().optional(),
        validationWith: z.string().nullable().optional(),
        statusWith: z.string().nullable().optional(),
        result: z.string().nullable().optional(),
        files: z
          .array(
            z
              .object({
                fileName: z.string().optional(),
                fileUrl: z.string().optional(),
                fields: z.record(z.unknown()).optional(),
              })
              .passthrough(),
          )
          .nullable()
          .optional(),
        imagesComparisonValidation: z.unknown().nullable().optional(),
        relatedProcess: z.array(z.unknown()).nullable().optional(),
        extraInfo: z.record(z.unknown()).nullable().optional(),
        externalValidations: z.record(z.unknown()).nullable().optional(),
        validationProcessResult: z.string().nullable().optional(),
      })
      .passthrough()
      .nullable(),
  })
  .passthrough();
export type GetValidationDataResponse = z.infer<typeof GetValidationDataResponseSchema>;

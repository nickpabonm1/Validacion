import { z } from "zod";

/** Envelope general documentado en Webhooks Service Definition v1.3, sección 2.1. */
export const WebhookEnvelopeSchema = z.object({
  id: z.string().min(1, "id es obligatorio"),
  idUser: z.string().optional(),
  event: z.string().min(1, "event es obligatorio"),
  creationDate: z.string().optional(),
  data: z.unknown().optional(),
  retry: z.number().optional(),
  error: z.string().nullable().optional(),
  idOriginal: z.string().nullable().optional(),
});
export type WebhookEnvelope = z.infer<typeof WebhookEnvelopeSchema>;

export const CreatedValidationStepDataSchema = z.object({
  key: z.string(),
  vector: z.string(),
  validationId: z.string(),
});

export const ResultValidationStepDataSchema = z
  .object({
    success: z.boolean().optional(),
    error: z.string().nullable().optional(),
    code: z.number().nullable().optional(),
    data: z.record(z.unknown()).optional(),
  })
  .passthrough();

export const CompletedValidationStepDataSchema = z.object({
  validationName: z.string().optional(),
  endDate: z.string().optional(),
  validationId: z.string(),
});

export const CompletedValidationDataSchema = z.object({
  validationName: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  validationId: z.string(),
  result: z.unknown().optional(),
});

export const ValidationChangeStatusDataSchema = z.object({
  validationId: z.string(),
  result: z.string().optional(),
  status: z.string().optional(),
});

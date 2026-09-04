import { z } from "zod";
import { RISK_LEVELS } from "@fad-console/shared-types";

/** Notificación entrante por webhook (PDF sección 2.3) — evento `VALIDATION_MESSAGE` con el
 * resultado de una solicitud enviada en modo asíncrono (`webhookNotification: true`). Esta
 * consola no dispara solicitudes en ese modo, pero expone este receptor por si NAAT-CHECK igual lo
 * usa (p. ej. reintentos tardíos) — el payload se registra para auditoría (ver
 * `naat-check-webhook.routes.ts`), sin intentar correlacionarlo con una ejecución específica. */
export const NaatCheckWebhookEnvelopeSchema = z.object({
  id: z.string(),
  idUser: z.string().optional(),
  event: z.string(),
  creationDate: z.string().optional(),
  data: z
    .object({
      idMessage: z.string().optional(),
      response: z
        .object({
          risk: z.enum(RISK_LEVELS).optional(),
          key: z.string().nullable().optional(),
        })
        .optional(),
      type: z.string().optional(),
      modificationDate: z.string().optional(),
    })
    .optional(),
  retry: z.number().optional(),
  error: z.string().nullable().optional(),
  idOriginal: z.string().nullable().optional(),
});
export type NaatCheckWebhookEnvelope = z.infer<typeof NaatCheckWebhookEnvelopeSchema>;

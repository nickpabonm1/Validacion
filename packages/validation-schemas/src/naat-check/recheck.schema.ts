import { z } from "zod";
import { RISK_LEVELS } from "@fad-console/shared-types";

/** Body de `POST {baseUrl}/naat-check-api/idholo/multiple` (PDF sección 2.2). Se usa siempre en
 * modo síncrono (`webhookNotification: false`) para el botón "Reevaluar con NAAT-CHECK": la
 * respuesta ya trae el resultado completo, sin depender de correlacionar un webhook asíncrono con
 * la ejecución que lo originó (el PDF no documenta un identificador de solicitud en el
 * `ack` síncrono que permita esa correlación con certeza). */
export const NaatCheckComposeMessageRequestSchema = z.object({
  webhookNotification: z.literal(false),
  files: z.array(
    z.object({
      file: z.string().min(1),
      type: z.string().min(1),
      name: z.string().min(1),
    }),
  ),
});
export type NaatCheckComposeMessageRequest = z.infer<typeof NaatCheckComposeMessageRequestSchema>;

/** Respuesta de éxito en modo síncrono (PDF sección 2.2, "OUTPUT PARAMETERS IN SUCCESSFUL CASE"):
 * `{success, error, code, data: {risk, key, result}}`. En caso de error:
 * `{success: false, error, code}` (sin `data`). */
export const NaatCheckComposeMessageResponseSchema = z.object({
  success: z.boolean().optional(),
  error: z.string().nullable().optional(),
  code: z.number().nullable().optional(),
  data: z
    .object({
      risk: z.enum(RISK_LEVELS),
      key: z.string().nullable().optional(),
      result: z.boolean().optional(),
    })
    .optional(),
});
export type NaatCheckComposeMessageResponse = z.infer<typeof NaatCheckComposeMessageResponseSchema>;

/** Notificación entrante por webhook (PDF sección 2.3) — evento `VALIDATION_MESSAGE` con el
 * resultado de una solicitud enviada en modo asíncrono (`webhookNotification: true`). Esta
 * consola no dispara solicitudes en ese modo (ver `NaatCheckComposeMessageRequestSchema`), pero
 * expone este receptor por si NAAT-CHECK igual lo usa (p. ej. reintentos tardíos) — el payload se
 * registra para auditoría (ver `naat-check.routes.ts`), sin intentar correlacionarlo con una
 * ejecución específica. */
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

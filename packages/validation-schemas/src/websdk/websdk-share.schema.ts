import { z } from "zod";

/** Payload para crear un enlace de captura Web SDK compartible (QR / correo / WhatsApp / copiar
 * enlace) — ver docs/websdk-integration.md "Envío de procesos". Mismo shape de cliente que
 * `WebSdkStartInputSchema`: el enlace guarda estos datos y los usa recién cuando el cliente final
 * abre `/v/:token` en su propio teléfono. */
export const WebSdkShareLinkInputSchema = z.object({
  environmentId: z.string().min(1),
  templateId: z.string().min(1).optional().nullable(),
  /// Plantilla Web SDK (textos/tema/umbrales) a aplicar — ver WebSdkTemplateInputSchema. Distinta
  /// de `templateId`, que apunta a ValidationTemplate (by-steps).
  webSdkTemplateId: z.string().min(1).optional().nullable(),
  processName: z.string().min(1).max(200).optional(),
  client: z.object({
    name: z.string().min(1).max(200),
    mail: z.string().email(),
    phone: z.string().min(1).max(40),
  }),
});
export type WebSdkShareLinkInput = z.infer<typeof WebSdkShareLinkInputSchema>;

/** Envío del enlace ya creado por un canal concreto. `destination` es el correo o el número de
 * WhatsApp (formato internacional, ej. +573001234567) — nunca se reutiliza el `client.mail`/
 * `client.phone` del enlace automáticamente: el operador confirma a dónde se envía. */
export const WebSdkShareSendInputSchema = z.object({
  channel: z.enum(["EMAIL", "WHATSAPP"]),
  destination: z.string().min(1).max(320),
});
export type WebSdkShareSendInput = z.infer<typeof WebSdkShareSendInputSchema>;

/** Payload que un SISTEMA EXTERNO envía (autenticado con la clave de API del ambiente, ver
 * `websdk-external.routes.ts`) para crear una validación Web SDK por su cuenta. Mismo shape que
 * `WebSdkShareLinkInputSchema` pero sin `environmentId`: el ambiente lo determina la clave de
 * API usada, nunca el cuerpo de la petición (evita que una clave de un ambiente cree enlaces en
 * otro). */
export const WebSdkExternalValidationInputSchema = z.object({
  templateId: z.string().min(1).optional().nullable(),
  webSdkTemplateId: z.string().min(1).optional().nullable(),
  processName: z.string().min(1).max(200).optional(),
  client: z.object({
    name: z.string().min(1).max(200),
    mail: z.string().email(),
    phone: z.string().min(1).max(40),
  }),
});
export type WebSdkExternalValidationInput = z.infer<typeof WebSdkExternalValidationInputSchema>;

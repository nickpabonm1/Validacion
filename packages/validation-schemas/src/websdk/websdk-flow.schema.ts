import { z } from "zod";

/** Payload para iniciar una ejecución en modelo Web SDK (ver docs/websdk-integration.md). */
export const WebSdkStartInputSchema = z.object({
  environmentId: z.string().min(1),
  templateId: z.string().min(1).optional().nullable(),
  processName: z.string().min(1).max(200).optional(),
  client: z.object({
    name: z.string().min(1).max(200),
    mail: z.string().email(),
    phone: z.string().min(1).max(40),
  }),
});
export type WebSdkStartInput = z.infer<typeof WebSdkStartInputSchema>;

/** Resultado normalizado de `startAcuant()` que el navegador reporta al backend. Las imágenes
 * viajan como data URI o base64 crudo (ver `apps/backend/src/normalize/media.ts`, que ya sabe
 * detectar ambos formatos). */
export const WebSdkAcuantResultInputSchema = z.object({
  frontImage: z.string().optional(),
  backImage: z.string().optional(),
  idPhoto: z.string().optional(),
  documentInstance: z.string().optional(),
  ocr: z.record(z.unknown()).optional(),
});
export type WebSdkAcuantResultInput = z.infer<typeof WebSdkAcuantResultInputSchema>;

/** Resultado normalizado de `startFacetec()` que el navegador reporta al backend. */
export const WebSdkFacetecResultInputSchema = z.object({
  selfie: z.string().optional(),
  faceScan: z.string().optional().nullable(),
  auditTrail: z.array(z.string()).optional(),
  lowQualityAuditTrail: z.array(z.string()).optional(),
  sessionId: z.string().optional().nullable(),
  status: z.number().optional(),
});
export type WebSdkFacetecResultInput = z.infer<typeof WebSdkFacetecResultInputSchema>;

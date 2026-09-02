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

/** Métricas de calidad de imagen que Acuant devuelve por cada lado del documento (ver FAD SDK
 * Web Acuant, sección "Result" — `data.id.front/back.{glare,dpi,cardType,sharpness,moire,
 * moireraw}`). Puramente diagnóstica, nunca contiene datos personales. */
export const WebSdkImageQualitySchema = z.object({
  glare: z.number().optional(),
  dpi: z.number().optional(),
  sharpness: z.number().optional(),
  moire: z.number().optional(),
  moireraw: z.number().optional(),
  cardType: z.number().optional(),
});
export type WebSdkImageQuality = z.infer<typeof WebSdkImageQualitySchema>;

/** Resultado normalizado de `startAcuant()` que el navegador reporta al backend. Las imágenes
 * viajan como data URI o base64 crudo (ver `apps/backend/src/normalize/media.ts`, que ya sabe
 * detectar ambos formatos). Además de las imágenes de captura (frente/reverso/idPhoto), Acuant
 * puede devolver dentro de `idData.ocr` campos que también son imágenes en base64 (`photo`,
 * `signature`, `fingerprint` — ver FAD SDK Web Acuant §3.7): se separan explícitamente
 * (`ocrPhoto`/`ocrSignature`/`ocrFingerprint`) para que se muestren como imágenes reales y nunca
 * como texto crudo en la tabla de OCR. `validation`, `classification` y `alerts` son los objetos
 * de `idData.validation`/`idData.classification`/`idData.alerts` documentados en el mismo PDF. */
export const WebSdkAcuantResultInputSchema = z.object({
  frontImage: z.string().optional(),
  backImage: z.string().optional(),
  idPhoto: z.string().optional(),
  documentInstance: z.string().optional(),
  ocr: z.record(z.unknown()).optional(),
  ocrPhoto: z.string().optional(),
  ocrSignature: z.string().optional(),
  ocrFingerprint: z.string().optional(),
  validation: z.record(z.unknown()).optional(),
  classification: z.record(z.unknown()).optional(),
  alerts: z.array(z.record(z.unknown())).optional(),
  frontQuality: WebSdkImageQualitySchema.optional(),
  backQuality: WebSdkImageQualitySchema.optional(),
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

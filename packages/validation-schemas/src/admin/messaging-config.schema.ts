import { z } from "zod";

/**
 * Configuración global de mensajería saliente (correo SMTP + WhatsApp Cloud API de Meta) usada
 * para enviar el enlace de captura Web SDK (ver `WebSdkShareLink`). Los campos de credenciales
 * son opcionales: vacío = "no cambiar" en una edición, igual que `ApiEnvironmentInputSchema`.
 */
export const MessagingConfigInputSchema = z.object({
  smtpHost: z.string().max(300).optional().nullable(),
  smtpPort: z.number().int().min(1).max(65535).default(587),
  smtpSecure: z.boolean().default(false),
  smtpUser: z.string().max(300).optional(),
  smtpPassword: z.string().max(500).optional(),
  fromAddress: z.string().email().optional().nullable(),
  fromName: z.string().max(200).default("FAD Biometrics Console"),

  whatsappApiBaseUrl: z.string().url().default("https://graph.facebook.com/v20.0"),
  whatsappPhoneNumberId: z.string().max(200).optional().nullable(),
  whatsappAccessToken: z.string().max(4000).optional(),
  whatsappTemplateName: z.string().max(200).optional().nullable(),
  whatsappTemplateLanguage: z.string().max(20).default("es"),
});
export type MessagingConfigInput = z.infer<typeof MessagingConfigInputSchema>;

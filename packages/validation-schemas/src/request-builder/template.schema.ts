import { z } from "zod";
import { StepsMapSchema } from "./steps.schema";
import { CustomizationSchema } from "./customization.schema";

const E164_PHONE = /^\+[1-9]\d{6,14}$/;

export const ClientConfigSchema = z.object({
  name: z.string().min(1, "El nombre del cliente es obligatorio").max(200),
  mail: z.string().email("Correo inválido").max(200),
  phone: z.string().regex(E164_PHONE, "Teléfono debe estar en formato internacional (+573001234567)"),
});

export const FeatureConfigSchema = z.object({
  redirect: z
    .object({
      url: z.string().url("Debe ser una URL segura").startsWith("https://", "La URL debe usar https"),
    })
    .optional(),
});

export const NotificationsConfigSchema = z.object({
  email: z.boolean().default(false),
  whatsapp: z.boolean().default(false),
});

/**
 * Estructura completa enviada a `POST {baseUrl}/biometrics-by-steps/validations`, más los
 * bloques de personalización visual y notificaciones (sección 13 del brief, confirmada por el
 * body real de la colección Postman `createValidation Autentic AF`).
 */
export const ValidationRequestConfigSchema = z.object({
  processName: z.string().min(1, "El nombre del proceso es obligatorio").max(150),
  validity: z.number().int().min(1, "La vigencia debe ser mayor que cero").max(365),
  client: ClientConfigSchema,
  steps: StepsMapSchema,
  customization: CustomizationSchema.default({ theme: [], header: [] }),
  feature: FeatureConfigSchema.default({}),
  notifications: NotificationsConfigSchema.default({ email: false, whatsapp: false }),
});
export type ValidationRequestConfig = z.infer<typeof ValidationRequestConfigSchema>;

/** Elimina claves vacías que la API no espera (sección 8 del brief: "no incluir propiedades
 * vacías que la API no acepte, salvo que sean necesarias"). */
export function pruneEmptyRequestFields(config: ValidationRequestConfig): unknown {
  const steps: Record<string, unknown> = {};
  for (const [key, step] of Object.entries(config.steps)) {
    const cleanStep: Record<string, unknown> = { order: step.order, show: step.show };
    if (step.configuration && Object.keys(step.configuration).length > 0) {
      cleanStep.configuration = step.configuration;
    }
    if (step.features && Object.keys(step.features).length > 0) {
      cleanStep.features = step.features;
    }
    if (step.input && Object.keys(step.input).length > 0) {
      cleanStep.input = step.input;
    }
    steps[key] = cleanStep;
  }

  const result: Record<string, unknown> = {
    processName: config.processName,
    validity: config.validity,
    client: config.client,
    steps,
  };

  if (config.customization.theme.length > 0 || config.customization.header.length > 0) {
    result.customization = config.customization;
  }
  if (config.feature.redirect?.url) {
    result.feature = config.feature;
  }
  if (config.notifications.email || config.notifications.whatsapp) {
    result.notifications = config.notifications;
  }
  return result;
}

import { z } from "zod";
import { RISK_LEVELS } from "@fad-console/shared-types";

/** Subconjunto de `WebSdkOnboardingMessagesSchema` que una plantilla puede sobreescribir — todos
 * los campos son opcionales (a diferencia de la versión del ambiente, que siempre trae los 14
 * campos con su valor por defecto): lo que la plantilla no toca, sigue siendo lo del ambiente. */
export const WebSdkTemplateOnboardingMessagesSchema = z.object({
  welcomeTitle: z.string().max(200).optional(),
  welcomeBody: z.string().max(2000).optional(),
  documentTitle: z.string().max(200).optional(),
  documentBody: z.string().max(2000).optional(),
  documentRetryBody: z.string().max(2000).optional(),
  livenessTitle: z.string().max(200).optional(),
  livenessBody: z.string().max(2000).optional(),
  completingTitle: z.string().max(200).optional(),
  completingBody: z.string().max(2000).optional(),
  successTitle: z.string().max(200).optional(),
  successBody: z.string().max(2000).optional(),
  blockedTitle: z.string().max(200).optional(),
  blockedBody: z.string().max(2000).optional(),
  genericErrorBody: z.string().max(2000).optional(),
});
export type WebSdkTemplateOnboardingMessages = z.infer<typeof WebSdkTemplateOnboardingMessagesSchema>;

/** Misma forma que `FadCustomization` (ver apps/frontend/src/lib/websdk-design.ts) — colores y
 * tipografías de los 4 módulos del Web SDK. */
const fadColorPalette = z.object({ primary: z.string().optional(), secondary: z.string().optional(), tertiary: z.string().optional() });
const fadButtonStyle = z.object({ backgroundColor: z.string().optional(), labelColor: z.string().optional() });
const fadFontStyle = z.object({ fontSize: z.string().optional(), fontFamily: z.string().optional() });

export const WebSdkTemplateCustomizationSchema = z.object({
  colors: fadColorPalette.optional(),
  buttons: z.object({ primary: fadButtonStyle.optional(), secondary: fadButtonStyle.optional() }).optional(),
  fonts: z
    .object({
      title: fadFontStyle.optional(),
      subtitle: fadFontStyle.optional(),
      content: fadFontStyle.optional(),
      button: fadFontStyle.optional(),
    })
    .optional(),
});
export type WebSdkTemplateCustomization = z.infer<typeof WebSdkTemplateCustomizationSchema>;

/**
 * Payload para crear/editar una plantilla Web SDK (ver prisma/schema.prisma `WebSdkTemplate` y
 * shared-types `WebSdkTemplateDto` para el porqué esta forma es distinta de
 * `ValidationTemplateInputSchema`). Los umbrales son opcionales/nulos: `null` = usa el del
 * ambiente, nunca se fabrica un valor por defecto propio de la plantilla.
 */
export const WebSdkTemplateInputSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional().nullable(),
  environmentId: z.string().min(1),
  active: z.boolean().default(true),
  onboardingMessages: WebSdkTemplateOnboardingMessagesSchema.default({}),
  customization: WebSdkTemplateCustomizationSchema.default({}),
  checkMaxAttempts: z.number().int().min(1).max(10).optional().nullable(),
  checkAcceptedRisk: z.enum(RISK_LEVELS).optional().nullable(),
  faceMatchMinConfidence: z.number().min(0).max(100).optional().nullable(),
});
export type WebSdkTemplateInput = z.infer<typeof WebSdkTemplateInputSchema>;

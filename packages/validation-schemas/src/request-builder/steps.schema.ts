import { z } from "zod";
import { STEP_KEYS } from "@fad-console/shared-types";
import { FormValidationIdInputSchema } from "./form.schema";

/**
 * Cada paso comparte `order` y `show` (documentados). `configuration`, `features` e `input`
 * son objetos libres cuyo contenido varía por paso (sección 2.2 y 11 del brief); se validan de
 * forma laxa aquí y de forma más estricta en los editores estructurados del frontend para los
 * pasos que sí tienen contrato conocido (ver STEP_PROPERTY_SCHEMAS más abajo). `advancedJson`
 * permite al operador sobreescribir configuration/features/input libremente para pasos sin
 * editor dedicado (nunca se usa `eval`, solo se valida como JSON).
 */
export const StepEntrySchema = z.object({
  order: z.number().int().min(1, "El orden debe ser >= 1"),
  show: z.boolean(),
  configuration: z.record(z.unknown()).default({}),
  features: z.record(z.unknown()).default({}),
  input: z.record(z.unknown()).optional(),
});
export type StepEntry = z.infer<typeof StepEntrySchema>;

export const StepsMapSchema = z
  .record(z.enum(STEP_KEYS as [string, ...string[]]), StepEntrySchema)
  .superRefine((steps, ctx) => {
    const entries = Object.entries(steps);
    const shown = entries.filter(([, v]) => v.show);
    const orders = shown.map(([, v]) => v.order);
    const duplicated = orders.filter((o, i) => orders.indexOf(o) !== i);
    if (duplicated.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Existen valores 'order' duplicados entre pasos visibles: ${[...new Set(duplicated)].join(", ")}`,
      });
    }
    const sorted = [...orders].sort((a, b) => a - b);
    const consecutive = sorted.every((value, index) => value === index + 1);
    if (shown.length > 0 && !consecutive) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Los valores 'order' de los pasos visibles deben ser consecutivos empezando en 1",
      });
    }
  });

/** Editores estructurados conocidos (sección 11). Se exportan por separado para que el
 * frontend valide `configuration`/`features`/`input` de cada paso con mayor precisión sin
 * restringir el contrato final enviado a FAD (que sigue usando StepEntrySchema, más laxo). */
export const LocationConfigurationSchema = z.object({
  explanatoryText: z.string().max(500).optional(),
  requireLocationAuthorization: z.boolean().optional(),
});
export const LocationFeaturesSchema = z.object({
  alwaysAskLocation: z.boolean().optional(),
});

export const PrivacyNoticeConfigurationSchema = z.object({
  title: z.string().max(200).optional(),
  content: z.string().max(5000).optional(),
  url: z.string().url().optional(),
  mandatory: z.boolean().optional(),
  acceptText: z.string().max(120).optional(),
  rejectText: z.string().max(120).optional(),
});

export const CaptureIdConfigurationSchema = z.object({
  captureFront: z.boolean().optional(),
  captureBack: z.boolean().optional(),
  country: z.string().max(3).optional(),
  documentType: z.string().max(60).optional(),
  documentDescription: z.string().max(200).optional(),
});
export const CaptureIdFeaturesSchema = z.object({
  provider: z.number().int(),
});

export const LivenessFeaturesSchema = z.object({
  provider: z.number().int(),
  viewRequired: z.boolean().optional(),
});

export const FingerprintsConfigurationSchema = z.object({
  fingers: z.array(z.string()).min(1).max(10),
  format: z.enum(["wsq", "jpeg", "both"]).optional(),
});

export const IdDetectionConfigurationSchema = z.object({
  startSecond: z.number().int().min(0).optional(),
  identifications: z
    .array(
      z.object({
        name: z.string(),
        title: z.object({ es: z.string(), en: z.string(), pt: z.string() }).partial(),
      }),
    )
    .optional(),
});

export const EnrollFaceInputSchema = z.object({
  validationId: z.string().optional(),
});
export const AuthFaceInputSchema = z.object({});

export const FORM_VALIDATION_ID_INPUT_SCHEMA = FormValidationIdInputSchema;

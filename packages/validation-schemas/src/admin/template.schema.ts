import { z } from "zod";
import { ValidationRequestConfigSchema } from "../request-builder/template.schema";

export const ValidationTemplateInputSchema = z.object({
  name: z.string().min(1, "El nombre de la plantilla es obligatorio").max(150),
  description: z.string().max(1000).optional(),
  environmentId: z.string().optional().nullable(),
  requestConfig: ValidationRequestConfigSchema,
  active: z.boolean().default(true),
});
export type ValidationTemplateInput = z.infer<typeof ValidationTemplateInputSchema>;

export const ExecuteValidationInputSchema = z.object({
  environmentId: z.string().min(1, "Selecciona un ambiente"),
  templateId: z.string().min(1, "Selecciona una plantilla").optional(),
  requestConfig: ValidationRequestConfigSchema,
});
export type ExecuteValidationInput = z.infer<typeof ExecuteValidationInputSchema>;

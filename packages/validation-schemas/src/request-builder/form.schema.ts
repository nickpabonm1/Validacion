import { z } from "zod";
import { FORM_FIELD_INPUT_TYPES } from "@fad-console/shared-types";

/** Campo de formulario del paso `formValidationId` (sección 11.4 del brief / colección Postman). */
export const FormFieldSchema = z.object({
  id: z.string().min(1, "El id del campo es obligatorio"),
  inputType: z.enum(FORM_FIELD_INPUT_TYPES),
  label: z.string().min(1, "La etiqueta es obligatoria").max(120),
  placeholder: z.string().max(200).optional(),
  required: z.boolean().default(false),
  replaceValue: z.boolean().optional(),
  value: z.string().max(500).optional(),
  order: z.number().int().min(0).default(0),
  visible: z.boolean().default(true),
  validation: z
    .object({
      minLength: z.number().int().min(0).optional(),
      maxLength: z.number().int().min(1).optional(),
      pattern: z.string().optional(),
    })
    .optional(),
});
export type FormField = z.infer<typeof FormFieldSchema>;

export const FormClassificationSchema = z.object({
  countryCode: z.string().min(2).max(3),
  cardType: z.union([z.number().int(), z.string()]),
  cardTypeDescription: z.string().min(1).max(200),
});

export const DynamicFormSchema = z
  .object({
    default: z.boolean().optional(),
    classification: FormClassificationSchema.optional(),
    fields: z.array(FormFieldSchema).min(1, "El formulario debe tener al menos un campo"),
  })
  .refine((form) => form.default === true || form.classification !== undefined, {
    message: "Un formulario debe ser 'default' o tener 'classification'",
  });
export type DynamicForm = z.infer<typeof DynamicFormSchema>;

export const FormValidationIdInputSchema = z.object({
  forms: z.array(DynamicFormSchema).default([]),
});

import { z } from "zod";
import { FIELD_RENDER_TYPES, SENSITIVITY_LEVELS, USER_ROLES } from "@fad-console/shared-types";

export const ResponseFieldConditionSchema = z.object({
  path: z.string().min(1),
  operator: z.enum(["eq", "neq", "exists", "notExists", "truthy", "falsy"]),
  value: z.union([z.string(), z.number(), z.boolean()]).optional(),
});

export const ResponseFieldConfigSchema = z.object({
  id: z.string().min(1),
  path: z.string().min(1, "La ruta del campo es obligatoria"),
  label: z.string().min(1, "El nombre visible es obligatorio").max(150),
  description: z.string().max(500).optional(),
  group: z.string().min(1).max(80),
  order: z.number().int().min(0),
  visible: z.boolean().default(true),
  showOnlyIfHasValue: z.boolean().default(false),
  condition: ResponseFieldConditionSchema.optional(),
  renderType: z.enum(FIELD_RENDER_TYPES),
  dateFormat: z.string().max(60).optional(),
  numberFormat: z.string().max(60).optional(),
  unit: z.string().max(30).optional(),
  badgeColorMap: z.record(z.enum(["success", "warning", "error", "info", "neutral"])).optional(),
  sensitivity: z.enum(SENSITIVITY_LEVELS).default("INTERNAL"),
  requiredRole: z.enum(USER_ROLES).optional(),
  defaultValue: z.string().max(200).optional(),
});
export type ResponseFieldConfigInput = z.infer<typeof ResponseFieldConfigSchema>;

export const ResponseViewConfigSchema = z.object({
  fields: z.array(ResponseFieldConfigSchema).default([]),
});

export const ResponseViewInputSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio").max(150),
  description: z.string().max(500).optional(),
  kind: z.enum(["EXECUTIVE", "OPERATIVE", "TECHNICAL", "CUSTOM"]).default("CUSTOM"),
  templateId: z.string().optional().nullable(),
  isDefault: z.boolean().default(false),
  configuration: ResponseViewConfigSchema,
});
export type ResponseViewInput = z.infer<typeof ResponseViewInputSchema>;

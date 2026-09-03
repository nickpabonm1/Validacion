import { z } from "zod";
import { RISK_LEVELS } from "@fad-console/shared-types";

/**
 * Configuración de NAAT-CHECK (NAAT.TECH "API RECHECK PROCESS") para un ambiente — ver
 * `NaatCheckConfigDto` en shared-types. `username`/`password` vacíos = "no cambiar" en una
 * edición, igual que otras credenciales (`ApiEnvironmentInputSchema`, `MessagingConfigInputSchema`).
 */
export const NaatCheckConfigInputSchema = z.object({
  enabled: z.boolean().default(false),
  baseUrl: z.string().url("Debe ser una URL válida").max(500),
  username: z.string().max(300).optional(),
  password: z.string().max(500).optional(),
  acceptedRiskLevel: z.enum(RISK_LEVELS).default("LOW"),
  webhookUsername: z.string().max(300).optional(),
  webhookPassword: z.string().max(500).optional(),
});
export type NaatCheckConfigInput = z.infer<typeof NaatCheckConfigInputSchema>;

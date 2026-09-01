import { z } from "zod";

/** POST {baseUrl}/authorization-server/oauth/token — respuesta de éxito documentada. */
export const FadTokenResponseSchema = z
  .object({
    access_token: z.string().min(1),
    token_type: z.string().min(1),
    refresh_token: z.string().optional(),
    expires_in: z.number(),
    scope: z.string().optional(),
    jti: z.string().optional(),
  })
  .passthrough();
export type FadTokenResponse = z.infer<typeof FadTokenResponseSchema>;

/** Catálogo de errores OAuth documentado en la sección 2.1. */
export const FadAuthErrorSchema = z
  .object({
    error: z.string(),
    error_description: z.string().optional(),
  })
  .passthrough();
export type FadAuthError = z.infer<typeof FadAuthErrorSchema>;

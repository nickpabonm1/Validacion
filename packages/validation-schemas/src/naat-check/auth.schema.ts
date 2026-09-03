import { z } from "zod";

/** POST {baseUrl}/authorization-server/oauth/token — respuesta de éxito documentada (PDF "FAD
 * Development Management — API CHECK Process Service Specification" v1.1, sección 2.1). Misma
 * forma que la autenticación OAuth de FAD, pero es un servicio y un contrato DISTINTO (NAAT.TECH,
 * no FAD) — se valida por separado para no acoplar ambos contratos. */
export const NaatCheckTokenResponseSchema = z
  .object({
    access_token: z.string().min(1),
    token_type: z.string().min(1),
    refresh_token: z.string().optional(),
    expires_in: z.number(),
    scope: z.string().optional(),
    jti: z.string().optional(),
  })
  .passthrough();
export type NaatCheckTokenResponse = z.infer<typeof NaatCheckTokenResponseSchema>;

/** Catálogo de errores OAuth documentado en la sección 2.1 del PDF. */
export const NaatCheckAuthErrorSchema = z
  .object({
    error: z.string(),
    error_description: z.string().optional(),
  })
  .passthrough();
export type NaatCheckAuthError = z.infer<typeof NaatCheckAuthErrorSchema>;

import { z } from "zod";

/** Envío por correo del enlace de captura de una ejecución del flujo API_BY_STEPS (`ShareLinkPanel`).
 * `publicUrl` viaja ya armado desde el frontend (incluye key/vector revelados por el operador, ver
 * `lib/launch-url.ts`) — el backend nunca reconstruye el enlace ni descifra credenciales por su
 * cuenta para este endpoint, solo envía el que el operador ya tiene visible en pantalla. */
export const SendExecutionEmailInputSchema = z.object({
  to: z.string().email(),
  publicUrl: z.string().url(),
});
export type SendExecutionEmailInput = z.infer<typeof SendExecutionEmailInputSchema>;

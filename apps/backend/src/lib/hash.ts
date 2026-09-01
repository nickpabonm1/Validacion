import { createHash } from "node:crypto";

/** SHA-256 en hexadecimal minúsculas, tal como documenta la sección 2.1 del PDF de FAD para
 * el password de autenticación. Se aplica UNA sola vez (nunca se hashea un valor ya hasheado,
 * ver `passwordIsPreHashed` en ApiEnvironment). */
export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

import jwt from "jsonwebtoken";
import type { UserRole } from "@fad-console/shared-types";
import { env } from "../../config/env";

export interface SessionTokenPayload {
  sub: string;
  email: string;
  role: UserRole;
  name: string;
  /** `null` = usuario de plataforma (acceso global). Con un cliente asignado, la sesión queda
   * confinada a ese cliente y a sus hijos — ver clients/client-scope.ts. */
  clientId: string | null;
}

const EXPIRES_IN = "12h";
export const SESSION_COOKIE_NAME = "fad_console_session";

export function signSessionToken(payload: SessionTokenPayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: EXPIRES_IN });
}

export function verifySessionToken(token: string): SessionTokenPayload | null {
  try {
    return jwt.verify(token, env.jwtSecret) as SessionTokenPayload;
  } catch {
    return null;
  }
}

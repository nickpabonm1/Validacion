import { prisma } from "../../lib/prisma";
import { constantTimeEqual } from "../../lib/constant-time";
import { credentialEncryptionService } from "../credentials/credential-encryption.service";

/**
 * Valida las credenciales Basic Auth del webhook entrante contra CUALQUIER ambiente activo que
 * tenga credenciales de webhook configuradas (comparación en tiempo constante). Si ningún
 * ambiente tiene credenciales de webhook configuradas todavía (instalación nueva / solo modo
 * demo), se permite el paso para no bloquear la puesta en marcha, pero queda registrado.
 */
export async function isWebhookRequestAuthorized(authorizationHeader: string | undefined): Promise<{
  authorized: boolean;
  reason: string;
}> {
  const environmentsWithWebhookAuth = await prisma.apiEnvironment.findMany({
    where: { webhookActive: true, webhookUsernameEnc: { not: null }, webhookPasswordEnc: { not: null } },
  });

  if (environmentsWithWebhookAuth.length === 0) {
    return { authorized: true, reason: "NO_WEBHOOK_CREDENTIALS_CONFIGURED" };
  }

  if (!authorizationHeader || !authorizationHeader.startsWith("Basic ")) {
    return { authorized: false, reason: "MISSING_AUTHORIZATION" };
  }

  let decoded: string;
  try {
    decoded = Buffer.from(authorizationHeader.slice("Basic ".length), "base64").toString("utf8");
  } catch {
    return { authorized: false, reason: "MALFORMED_AUTHORIZATION" };
  }
  const separatorIndex = decoded.indexOf(":");
  if (separatorIndex < 0) return { authorized: false, reason: "MALFORMED_AUTHORIZATION" };
  const providedUsername = decoded.slice(0, separatorIndex);
  const providedPassword = decoded.slice(separatorIndex + 1);

  for (const environment of environmentsWithWebhookAuth) {
    const username = credentialEncryptionService.decryptOrNull(environment.webhookUsernameEnc);
    const password = credentialEncryptionService.decryptOrNull(environment.webhookPasswordEnc);
    if (!username || !password) continue;
    if (constantTimeEqual(providedUsername, username) && constantTimeEqual(providedPassword, password)) {
      return { authorized: true, reason: "OK" };
    }
  }

  return { authorized: false, reason: "INVALID_CREDENTIALS" };
}

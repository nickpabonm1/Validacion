import { prisma } from "../../lib/prisma";
import { constantTimeEqual } from "../../lib/constant-time";
import { credentialEncryptionService } from "../credentials/credential-encryption.service";

/** Mismo patrón que `webhooks/webhook-auth.ts` (FAD), pero contra `NaatCheckConfig` — las
 * credenciales que esta consola le entrega a NAAT-CHECK para llamar de vuelta a su webhook. */
export async function isNaatCheckWebhookAuthorized(authorizationHeader: string | undefined): Promise<{
  authorized: boolean;
  reason: string;
}> {
  const configsWithWebhookAuth = await prisma.naatCheckConfig.findMany({
    where: { enabled: true, webhookUsernameEnc: { not: null }, webhookPasswordEnc: { not: null } },
  });

  if (configsWithWebhookAuth.length === 0) {
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

  for (const config of configsWithWebhookAuth) {
    const username = credentialEncryptionService.decryptOrNull(config.webhookUsernameEnc);
    const password = credentialEncryptionService.decryptOrNull(config.webhookPasswordEnc);
    if (!username || !password) continue;
    if (constantTimeEqual(providedUsername, username) && constantTimeEqual(providedPassword, password)) {
      return { authorized: true, reason: "OK" };
    }
  }

  return { authorized: false, reason: "INVALID_CREDENTIALS" };
}

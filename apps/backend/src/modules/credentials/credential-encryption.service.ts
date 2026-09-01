import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "../../config/env";
import { AppError } from "../../lib/errors";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const CURRENT_VERSION = "v1";

/**
 * CredentialEncryptionService — cifra/descifra secretos (contraseñas, usuarios de Basic Auth,
 * credenciales de webhook) con AES-256-GCM antes de persistirlos. La llave maestra
 * (`APP_ENCRYPTION_KEY`) nunca se guarda en base de datos; solo vive en el entorno del proceso
 * backend. Ver docs/security-decisions.md.
 *
 * Formato almacenado: `v1:<ivBase64>:<authTagBase64>:<ciphertextBase64>` — versionado para
 * permitir una futura rotación de algoritmo/llave sin migrar datos a mano.
 */
class CredentialEncryptionService {
  private getKey(): Buffer {
    const key = Buffer.from(env.appEncryptionKey, "base64");
    if (key.length !== 32) {
      throw new Error(
        "APP_ENCRYPTION_KEY debe ser una llave de 32 bytes en base64. Genere una nueva con " +
          "\"npm run generate:encryption-key\".",
      );
    }
    return key;
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.getKey(), iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return [CURRENT_VERSION, iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(
      ":",
    );
  }

  decrypt(stored: string): string {
    const parts = stored.split(":");
    if (parts.length !== 4 || parts[0] !== CURRENT_VERSION) {
      throw AppError.badRequest("Formato de credencial cifrada no reconocido o versión no soportada");
    }
    const [, ivB64, tagB64, dataB64] = parts;
    const decipher = createDecipheriv(ALGORITHM, this.getKey(), Buffer.from(ivB64!, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64!, "base64"));
    const plaintext = Buffer.concat([decipher.update(Buffer.from(dataB64!, "base64")), decipher.final()]);
    return plaintext.toString("utf8");
  }

  /** Cifra solo si hay un valor no vacío; útil para "vacío = no cambiar" en formularios de edición. */
  encryptIfPresent(value: string | undefined | null): string | undefined {
    if (value === undefined || value === null || value.length === 0) return undefined;
    return this.encrypt(value);
  }

  decryptOrNull(stored: string | null | undefined): string | null {
    if (!stored) return null;
    return this.decrypt(stored);
  }

  isConfigured(stored: string | null | undefined): boolean {
    return Boolean(stored && stored.length > 0);
  }
}

export const credentialEncryptionService = new CredentialEncryptionService();

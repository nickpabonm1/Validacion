import { createCipheriv, createHash } from "node:crypto";

/**
 * Cifrado del flujo `saveValidationData` (ver docs/Integration_saveValidationData_service.pdf y
 * el proyecto de referencia `fad-demo-v1/src/app/services/crypto.service.ts`, verificado contra
 * UATHA):
 *
 *  1. `getValidationKeys` devuelve `key`/`vector` OFUSCADAS (el backend de FAD resta 1 al código
 *     de cada carácter — `Commons.obfuscate`). Hay que des-ofuscarlas (sumar 1) antes de usarlas.
 *  2. Se arma un .TAR con los archivos (ver `tar-writer.ts`).
 *  3. Se cifra el .TAR con AES-256-CBC (key/vector des-ofuscadas, PKCS7) y el resultado se
 *     convierte a Hexadecimal — ese texto (como bytes) ES el archivo `.FAD`.
 *  4. El checksum es HEX( AES-256-CBC( bytes crudos del SHA-256 del archivo `.FAD` ) ), con la
 *     misma key/vector. Equivale a `CryptManager.hashFile` en el backend de FAD:
 *     `encrypt(Hex.decodeHex(sha256Hex))`.
 *
 * La documentación de FAD exige explícitamente el estándar **AES256**: a diferencia de la
 * referencia en Angular (que usa `crypto-js`, el cual selecciona AES-128/192/256 según la
 * longitud de la key sin advertir del cambio), aquí se valida que la key/vector des-ofuscadas
 * tengan exactamente 32/16 bytes y se falla explícitamente si no — mejor un error claro que
 * cifrar silenciosamente con un algoritmo distinto al documentado.
 */

const ALGORITHM = "aes-256-cbc";
const EXPECTED_KEY_BYTES = 32;
const EXPECTED_IV_BYTES = 16;

/** Des-ofusca (+1 al código de cada carácter) — equivalente a `Commons.deobfuscate` del backend FAD. */
export function deobfuscateFadKey(value: string): string {
  let out = "";
  for (let i = 0; i < value.length; i++) {
    out += String.fromCharCode(value.charCodeAt(i) + 1);
  }
  return out;
}

function toKeyBuffer(deobfuscated: string, label: string, expectedBytes: number): Buffer {
  const buffer = Buffer.from(deobfuscated, "utf8");
  if (buffer.length !== expectedBytes) {
    throw new Error(
      `${label} des-ofuscada tiene ${buffer.length} bytes; se esperaban ${expectedBytes} para AES-256-CBC. ` +
        "Verifique la respuesta de getValidationKeys.",
    );
  }
  return buffer;
}

export interface FadEncryptionResult {
  /** Contenido del archivo .FAD: el hex del TAR cifrado, como bytes (application/octet-stream). */
  fadBuffer: Buffer;
  /** Checksum en hex, para el header `checksum` de saveValidationData. */
  checksum: string;
}

/**
 * Cifra el .TAR a .FAD y calcula su checksum, a partir de la key/vector OFUSCADAS tal como las
 * devuelve `getValidationKeys` (esta función las des-ofusca internamente).
 */
export function buildFadFile(tarBuffer: Buffer, obfuscatedKey: string, obfuscatedVector: string): FadEncryptionResult {
  const key = toKeyBuffer(deobfuscateFadKey(obfuscatedKey), "La key", EXPECTED_KEY_BYTES);
  const iv = toKeyBuffer(deobfuscateFadKey(obfuscatedVector), "El vector", EXPECTED_IV_BYTES);

  const tarCipher = createCipheriv(ALGORITHM, key, iv);
  const encryptedTar = Buffer.concat([tarCipher.update(tarBuffer), tarCipher.final()]);
  const fadBuffer = Buffer.from(encryptedTar.toString("hex"), "utf8");

  const digest = createHash("sha256").update(fadBuffer).digest();
  const digestCipher = createCipheriv(ALGORITHM, key, iv);
  const encryptedDigest = Buffer.concat([digestCipher.update(digest), digestCipher.final()]);
  const checksum = encryptedDigest.toString("hex");

  return { fadBuffer, checksum };
}

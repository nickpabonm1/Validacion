import { createDecipheriv, createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildFadFile, deobfuscateFadKey } from "./websdk-crypto";

/** Ofusca (-1 al código de cada carácter) — inverso de deobfuscateFadKey, usado solo para
 * construir fixtures de prueba (simula lo que hace `Commons.obfuscate` en el backend de FAD). */
function obfuscate(value: string): string {
  let out = "";
  for (let i = 0; i < value.length; i++) {
    out += String.fromCharCode(value.charCodeAt(i) - 1);
  }
  return out;
}

const KEY_32 = "0123456789abcdef0123456789abcdef"; // 32 caracteres ASCII = 32 bytes UTF-8
const IV_16 = "fedcba9876543210"; // 16 caracteres ASCII = 16 bytes UTF-8

describe("deobfuscateFadKey", () => {
  it("revierte exactamente la ofuscación (+1 después de -1)", () => {
    expect(deobfuscateFadKey(obfuscate(KEY_32))).toBe(KEY_32);
    expect(deobfuscateFadKey(obfuscate(IV_16))).toBe(IV_16);
  });
});

describe("buildFadFile", () => {
  const tar = Buffer.from("contenido de prueba del .TAR, no es un TAR real pero sirve para el cifrado");

  it("produce un .FAD (hex como bytes) que se puede volver a la data original al descifrarlo", () => {
    const { fadBuffer, checksum } = buildFadFile(tar, obfuscate(KEY_32), obfuscate(IV_16));

    // El .FAD es el hex del TAR cifrado, como texto/bytes.
    const fadHex = fadBuffer.toString("utf8");
    expect(/^[0-9a-f]+$/.test(fadHex)).toBe(true);

    const encryptedTar = Buffer.from(fadHex, "hex");
    const decipher = createDecipheriv("aes-256-cbc", Buffer.from(KEY_32, "utf8"), Buffer.from(IV_16, "utf8"));
    const decrypted = Buffer.concat([decipher.update(encryptedTar), decipher.final()]);
    expect(decrypted.equals(tar)).toBe(true);

    // El checksum es hex y de longitud par (bytes cifrados codificados en hex).
    expect(/^[0-9a-f]+$/.test(checksum)).toBe(true);
    expect(checksum.length % 2).toBe(0);
  });

  it("el checksum es AES( SHA-256(.FAD) ) — se puede verificar descifrándolo y comparando el hash", () => {
    const { fadBuffer, checksum } = buildFadFile(tar, obfuscate(KEY_32), obfuscate(IV_16));

    const checksumCipherBytes = Buffer.from(checksum, "hex");
    const decipher = createDecipheriv("aes-256-cbc", Buffer.from(KEY_32, "utf8"), Buffer.from(IV_16, "utf8"));
    const decryptedDigest = Buffer.concat([decipher.update(checksumCipherBytes), decipher.final()]);

    const expectedDigest = createHash("sha256").update(fadBuffer).digest();
    expect(decryptedDigest.equals(expectedDigest)).toBe(true);
  });

  it("da resultados deterministas: dos ejecuciones con la misma key/vector dan el mismo .FAD y checksum", () => {
    const a = buildFadFile(tar, obfuscate(KEY_32), obfuscate(IV_16));
    const b = buildFadFile(tar, obfuscate(KEY_32), obfuscate(IV_16));
    expect(a.fadBuffer.equals(b.fadBuffer)).toBe(true);
    expect(a.checksum).toBe(b.checksum);
  });

  it("lanza un error claro si la key des-ofuscada no tiene 32 bytes", () => {
    expect(() => buildFadFile(tar, obfuscate("clave-demasiado-corta"), obfuscate(IV_16))).toThrow(/32/);
  });

  it("lanza un error claro si el vector des-ofuscado no tiene 16 bytes", () => {
    expect(() => buildFadFile(tar, obfuscate(KEY_32), obfuscate("corto"))).toThrow(/16/);
  });
});

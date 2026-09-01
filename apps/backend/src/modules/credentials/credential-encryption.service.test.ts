import { describe, expect, it } from "vitest";
import { credentialEncryptionService } from "./credential-encryption.service";

describe("CredentialEncryptionService", () => {
  it("cifra y descifra un secreto (round-trip)", () => {
    const plaintext = "s3cr3t-value-!@#";
    const encrypted = credentialEncryptionService.encrypt(plaintext);
    expect(encrypted).not.toContain(plaintext);
    expect(encrypted.startsWith("v1:")).toBe(true);
    expect(credentialEncryptionService.decrypt(encrypted)).toBe(plaintext);
  });

  it("produce ciphertexts distintos para el mismo valor (IV aleatorio)", () => {
    const a = credentialEncryptionService.encrypt("same-value");
    const b = credentialEncryptionService.encrypt("same-value");
    expect(a).not.toBe(b);
  });

  it("encryptIfPresent devuelve undefined para valores vacíos (== conservar existente)", () => {
    expect(credentialEncryptionService.encryptIfPresent(undefined)).toBeUndefined();
    expect(credentialEncryptionService.encryptIfPresent("")).toBeUndefined();
    expect(credentialEncryptionService.encryptIfPresent(null)).toBeUndefined();
    expect(credentialEncryptionService.encryptIfPresent("x")).toBeDefined();
  });

  it("isConfigured refleja si hay un secreto guardado", () => {
    expect(credentialEncryptionService.isConfigured(null)).toBe(false);
    expect(credentialEncryptionService.isConfigured(undefined)).toBe(false);
    expect(credentialEncryptionService.isConfigured("")).toBe(false);
    expect(credentialEncryptionService.isConfigured(credentialEncryptionService.encrypt("x"))).toBe(true);
  });

  it("rechaza un valor cifrado con formato/versión no reconocida", () => {
    expect(() => credentialEncryptionService.decrypt("not-a-valid-payload")).toThrow();
    expect(() => credentialEncryptionService.decrypt("v9:a:b:c")).toThrow();
  });
});

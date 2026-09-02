import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiEnvironment } from "@prisma/client";
import { credentialEncryptionService } from "../credentials/credential-encryption.service";
import { sha256Hex } from "../../lib/hash";
import { clearCachedToken } from "./token-cache";
import { fadApiAdapter } from "./fad-api-adapter";

function buildEnvironment(overrides: Partial<ApiEnvironment> = {}): ApiEnvironment {
  const now = new Date();
  return {
    id: "env-test",
    name: "Test env",
    description: null,
    environmentType: "UATHA",
    baseUrl: "https://fad.test.invalid",
    active: true,
    timeoutMs: 5000,
    maxRetries: 1,
    basicAuthUsernameEnc: credentialEncryptionService.encrypt("basic-user"),
    basicAuthPasswordEnc: credentialEncryptionService.encrypt("basic-pass"),
    apiUsernameEnc: credentialEncryptionService.encrypt("api-user"),
    apiPasswordEnc: credentialEncryptionService.encrypt("plain-password"),
    webhookUsernameEnc: null,
    webhookPasswordEnc: null,
    credentialsEncryptionVersion: 1,
    grantType: "password",
    passwordIsPreHashed: false,
    tokenRefreshMarginSeconds: 60,
    authTokenEndpoint: "/authorization-server/oauth/token",
    createValidationEndpoint: "/biometrics-by-steps/validations",
    saveValidationStepEndpoint: "/validation/saveValidationStep/{validationId}",
    getValidationStepEndpoint: "/validation/getValidationStep/{validationId}",
    getValidationStepHttpMethod: "GET",
    getValidationDataEndpoint: "/validation/validations/getValidationData/{validationId}",
    launchUrlTemplate: null,
    webhookUrl: null,
    webhookActive: false,
    connectionStatus: "NOT_CONFIGURED",
    lastTestedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("FadApiAdapter", () => {
  beforeEach(() => {
    clearCachedToken("env-test");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("hashea el password con SHA-256 una sola vez cuando passwordIsPreHashed=false", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, { access_token: "tok", token_type: "bearer", expires_in: 3600 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const environment = buildEnvironment({ passwordIsPreHashed: false });
    const result = await fadApiAdapter.testConnection(environment);

    expect(result.success).toBe(true);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.headers).toMatchObject({ Authorization: expect.stringMatching(/^Basic /) });
    const sentBody = new URLSearchParams(init.body as string);
    expect(sentBody.get("password")).toBe(sha256Hex("plain-password"));
    expect(sentBody.get("password")).not.toBe("plain-password");
  });

  it("no vuelve a hashear cuando passwordIsPreHashed=true", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, { access_token: "tok", token_type: "bearer", expires_in: 3600 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const environment = buildEnvironment({ passwordIsPreHashed: true });
    await fadApiAdapter.testConnection(environment);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const sentBody = new URLSearchParams(init.body as string);
    expect(sentBody.get("password")).toBe("plain-password");
  });

  it("usa el método HTTP configurado (GET por defecto en UATHA) para getValidationStep sin body", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { access_token: "tok", token_type: "bearer", expires_in: 3600 }))
      .mockResolvedValueOnce(jsonResponse(200, { success: true, error: null, code: null, data: null }));
    vi.stubGlobal("fetch", fetchMock);

    const environment = buildEnvironment();
    await fadApiAdapter.getValidationStep(environment, "abc-123");

    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toContain("/validation/getValidationStep/abc-123");
    expect(init.method).toBe("GET");
    expect(init.body).toBeUndefined();
  });

  it("reintenta ante un error 5xx y luego tiene éxito", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(500, { error: "boom" }))
      .mockResolvedValueOnce(jsonResponse(200, { access_token: "tok", token_type: "bearer", expires_in: 3600 }));
    vi.stubGlobal("fetch", fetchMock);

    const environment = buildEnvironment({ maxRetries: 1 });
    const result = await fadApiAdapter.testConnection(environment);

    expect(result.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("testConnection no lanza y reporta fallo cuando la autenticación falla", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(401, { error: "invalid_grant", error_description: "Bad credentials" }));
    vi.stubGlobal("fetch", fetchMock);

    const environment = buildEnvironment({ maxRetries: 0 });
    const result = await fadApiAdapter.testConnection(environment);

    expect(result.success).toBe(false);
    expect(result.code).toBe("AUTHENTICATION_FAILED");
  });

  it("agota los reintentos y lanza un error de red ante timeouts repetidos", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new DOMException("The operation was aborted", "AbortError"));
    vi.stubGlobal("fetch", fetchMock);

    const environment = buildEnvironment({ maxRetries: 2 });
    await expect(fadApiAdapter.getValidationData(environment, "abc")).rejects.toThrow(/no fue posible conectar/i);
    // La autenticación (previa a la llamada real) agota sus 3 intentos (1 inicial + 2 reintentos)
    // y falla antes de siquiera llegar a solicitar getValidationData.
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("lanza un error controlado cuando la respuesta no cumple el contrato esperado", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { access_token: "tok", token_type: "bearer", expires_in: 3600 }))
      .mockResolvedValueOnce(jsonResponse(200, { unexpected: "shape", success: "not-a-boolean" }));
    vi.stubGlobal("fetch", fetchMock);

    const environment = buildEnvironment();
    await expect(fadApiAdapter.getValidationStep(environment, "abc")).rejects.toThrow(/no tiene el formato esperado/i);
  });

  it(
    "normaliza la respuesta real de getValidationStep (GET) — sin envoltura {success,data}, el " +
      "objeto data viene directo en la raíz — confirmado con una respuesta real de FAD",
    async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(200, { access_token: "tok", token_type: "bearer", expires_in: 3600 }))
        .mockResolvedValueOnce(
          jsonResponse(200, {
            processName: "PRUEBA",
            validation: { idProcess: "18da8ab4-1983-4443-b746-65b162eef7a1", status: "FINISHED" },
            client: { name: "PRUEBA", mail: "n1@gmail.com", phone: "20" },
            steps: { privacyNotice: { order: 1, status: "COMPLETED", show: true } },
          }),
        );
      vi.stubGlobal("fetch", fetchMock);

      const environment = buildEnvironment();
      const result = await fadApiAdapter.getValidationStep(environment, "18da8ab4-1983-4443-b746-65b162eef7a1");
      expect(result.data.success).toBe(true);
      expect(result.data.data?.processName).toBe("PRUEBA");
      expect(result.data.data?.validation?.status).toBe("FINISHED");
    },
  );

  it(
    "normaliza el error real de getValidationStep (GET) — {code,message} sin `success`, " +
      "confirmado con una respuesta real de FAD para un validationId inexistente",
    async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(200, { access_token: "tok", token_type: "bearer", expires_in: 3600 }))
        .mockResolvedValueOnce(jsonResponse(400, { code: "InvalidInputParameter", message: "Unable find the validation" }));
      vi.stubGlobal("fetch", fetchMock);

      const environment = buildEnvironment();
      const result = await fadApiAdapter.getValidationStep(environment, "no-existe");
      expect(result.data.success).toBe(false);
      expect(result.data.error).toBe("Unable find the validation");
      expect(result.data.data).toBeNull();
    },
  );
});

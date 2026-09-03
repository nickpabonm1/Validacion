import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sha256Hex } from "../../lib/hash";
import { clearCachedToken } from "../fad-adapter/token-cache";
import { requestNaatCheckRecheck, testNaatCheckConnection } from "./naat-check-client";

const params = { environmentId: "naat-test-env", baseUrl: "https://uat.firmaautografa.com", username: "user@dominio.com", password: "plain-password" };

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("naat-check-client: autenticación OAuth y recheck (PDF API RECHECK PROCESS v1.1)", () => {
  beforeEach(() => {
    clearCachedToken(`naat-check:${params.environmentId}`);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("hashea el password con SHA-256 antes de enviarlo (sección 2.1 del PDF), nunca en texto plano", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { access_token: "tok", token_type: "bearer", expires_in: 43199 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await testNaatCheckConnection(params);

    expect(result.success).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://uat.firmaautografa.com/authorization-server/oauth/token");
    const sentBody = new URLSearchParams(init.body as string);
    expect(sentBody.get("grant_type")).toBe("password");
    expect(sentBody.get("username")).toBe(params.username);
    expect(sentBody.get("password")).toBe(sha256Hex(params.password));
    expect(sentBody.get("password")).not.toBe(params.password);
  });

  it("testNaatCheckConnection reporta un fallo real (nunca fabricado) cuando la autenticación es rechazada", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(401, { error: "unauthorized_user", error_description: "Bad credentials" }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await testNaatCheckConnection(params);
    expect(result.success).toBe(false);
    expect(result.message).toContain("Bad credentials");
  });

  it("requestNaatCheckRecheck envía webhookNotification:false y los archivos con Bearer token", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { access_token: "tok-abc", token_type: "bearer", expires_in: 43199 }))
      .mockResolvedValueOnce(
        jsonResponse(200, { success: true, error: null, code: 200, data: { risk: "MEDIUM", key: "TEMP_DATA_RISK", result: false } }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const files = [{ file: "base64frontimage", type: "image/jpeg", name: "ID_VA_FRONT" }];
    const data = await requestNaatCheckRecheck(params, files);

    expect(data).toEqual({ risk: "MEDIUM", key: "TEMP_DATA_RISK", result: false });
    const [url, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(url).toBe("https://uat.firmaautografa.com/naat-check-api/idholo/multiple");
    expect(init.headers).toMatchObject({ Authorization: "Bearer tok-abc" });
    const sentBody = JSON.parse(init.body as string);
    expect(sentBody.webhookNotification).toBe(false);
    expect(sentBody.files).toEqual(files);
  });

  it("reutiliza el token en cache dentro de la misma sesión (no vuelve a autenticar)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { access_token: "tok-1", token_type: "bearer", expires_in: 43199 }))
      .mockResolvedValueOnce(jsonResponse(200, { success: true, error: null, code: 200, data: { risk: "LOW", key: null, result: true } }))
      .mockResolvedValueOnce(jsonResponse(200, { success: true, error: null, code: 200, data: { risk: "LOW", key: null, result: true } }));
    vi.stubGlobal("fetch", fetchMock);

    await requestNaatCheckRecheck(params, [{ file: "a", type: "image/jpeg", name: "x" }]);
    await requestNaatCheckRecheck(params, [{ file: "b", type: "image/jpeg", name: "y" }]);

    expect(fetchMock).toHaveBeenCalledTimes(3); // 1 auth + 2 compose (el segundo compose reutiliza el token)
  });

  it("lanza un error real cuando NAAT-CHECK responde success:false", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { access_token: "tok", token_type: "bearer", expires_in: 43199 }))
      .mockResolvedValueOnce(jsonResponse(500, { success: false, error: "Internal error", code: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(requestNaatCheckRecheck(params, [{ file: "a", type: "image/jpeg", name: "x" }])).rejects.toThrow("Internal error");
  });

  it("rechaza sin llamar a la red si no hay archivos que enviar", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(requestNaatCheckRecheck(params, [])).rejects.toThrow(/imágenes/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

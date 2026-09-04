import { afterEach, describe, expect, it, vi } from "vitest";
import { sha256Hex } from "../../lib/hash";
import { testNaatCheckConnection } from "./naat-check-client";

const params = { environmentId: "naat-test-env", baseUrl: "https://uat.firmaautografa.com", username: "user@dominio.com", password: "plain-password" };

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("naat-check-client: autenticación OAuth (PDF API RECHECK PROCESS v1.1, sección 2.1)", () => {
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

  it("testNaatCheckConnection siempre vuelve a autenticar (no reutiliza ningún token en cache)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { access_token: "tok", token_type: "bearer", expires_in: 43199 }));
    vi.stubGlobal("fetch", fetchMock);

    await testNaatCheckConnection(params);
    await testNaatCheckConnection(params);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

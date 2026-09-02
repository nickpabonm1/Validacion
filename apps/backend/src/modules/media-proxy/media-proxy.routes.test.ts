import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../../app";
import { prisma } from "../../lib/prisma";
import { toJsonField } from "../../lib/json-field";
import { credentialEncryptionService } from "../credentials/credential-encryption.service";
import { clearCachedToken } from "../fad-adapter/token-cache";

const app = createApp();

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("Media proxy: autenticación contra FAD (integración)", () => {
  let cookie: string;
  let executionId: string;
  let environmentId: string;

  beforeAll(async () => {
    await prisma.validationExecution.deleteMany();
    await prisma.apiEnvironment.deleteMany();
    await prisma.user.deleteMany();

    await request(app).post("/api/auth/bootstrap/admin").send({
      name: "Admin de Prueba",
      email: "admin.media@example.com",
      password: "SuperSegura123!",
    });
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin.media@example.com", password: "SuperSegura123!" });
    cookie = login.headers["set-cookie"];

    const environment = await prisma.apiEnvironment.create({
      data: {
        name: "Env de prueba media proxy",
        environmentType: "UATHA",
        baseUrl: "https://fad.test.invalid",
        basicAuthUsernameEnc: credentialEncryptionService.encrypt("basic-user"),
        basicAuthPasswordEnc: credentialEncryptionService.encrypt("basic-pass"),
        apiUsernameEnc: credentialEncryptionService.encrypt("api-user"),
        apiPasswordEnc: credentialEncryptionService.encrypt("api-pass"),
        passwordIsPreHashed: true,
      },
    });
    environmentId = environment.id;
    clearCachedToken(environmentId);

    const execution = await prisma.validationExecution.create({
      data: {
        processName: "Prueba media proxy",
        environmentId,
        requestPayload: toJsonField({ client: { name: "Cliente" }, steps: {} }),
        normalizedResponse: toJsonField({
          files: [{ fileName: "image_id_front.png", fileUrl: "https://fad.test.invalid/validation/getValidationMedia/x/image_id_front.png", fields: {} }],
        }),
        clientNameMasked: "C*****",
        clientEmailMasked: "c***@example.com",
        isDemo: false,
      },
    });
    executionId = execution.id;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("envía el access_token OAuth en la petición al archivo real de FAD (antes se pedía sin autenticación)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { access_token: "tok-media", token_type: "bearer", expires_in: 3600 }))
      .mockResolvedValueOnce(
        new Response(new Uint8Array([1, 2, 3]), { status: 200, headers: { "content-type": "image/png" } }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const res = await request(app).get(`/api/media-proxy/${executionId}/0`).set("Cookie", cookie);
    expect(res.status).toBe(200);

    // La primera llamada es la autenticación OAuth; la segunda es la solicitud del archivo real.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const mediaCall = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(mediaCall[0]).toBe("https://fad.test.invalid/validation/getValidationMedia/x/image_id_front.png");
    const headers = mediaCall[1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer tok-media");
  });
});

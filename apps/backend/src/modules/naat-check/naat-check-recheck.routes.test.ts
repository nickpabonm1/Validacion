import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../../app";
import { prisma } from "../../lib/prisma";
import { toJsonField } from "../../lib/json-field";
import { clearCachedToken } from "../fad-adapter/token-cache";

const app = createApp();

async function login(email: string, password = "SuperSegura123!"): Promise<string> {
  const res = await request(app).post("/api/auth/login").send({ email, password });
  return res.headers["set-cookie"];
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("POST /api/executions/:id/naat-check — recheck manual", () => {
  let adminCookie: string;
  let environmentId: string;

  beforeAll(async () => {
    await prisma.validationExecution.deleteMany();
    await prisma.naatCheckConfig.deleteMany();
    await prisma.apiEnvironment.deleteMany();
    await prisma.user.deleteMany();

    await request(app).post("/api/auth/bootstrap/admin").send({
      name: "Admin de Prueba",
      email: "admin.naatcheckrecheck@example.com",
      password: "SuperSegura123!",
    });
    adminCookie = await login("admin.naatcheckrecheck@example.com");

    const envRes = await request(app)
      .post("/api/environments")
      .set("Cookie", adminCookie)
      .send({ name: "Env recheck", environmentType: "UATHA", baseUrl: "https://fad.test.invalid" });
    environmentId = envRes.body.environment.id;

    await request(app)
      .put(`/api/environments/${environmentId}/naat-check-config`)
      .set("Cookie", adminCookie)
      .send({ enabled: true, baseUrl: "https://uat.firmaautografa.com", username: "user@dominio.com", password: "clave", acceptedRiskLevel: "LOW" });
  });

  beforeEach(async () => {
    clearCachedToken(`naat-check:${environmentId}`);
    await prisma.naatCheckConfig.update({ where: { environmentId }, data: { enabled: true } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  /** Cada prueba crea su propia ejecución: un recheck exitoso vuelve a derivar
   * `normalizedResponse` desde los datos crudos de FAD (aquí vacíos), lo que borraría
   * `mediaAssets` para una prueba posterior que reutilizara la misma ejecución. */
  async function createFixtureExecution(): Promise<string> {
    const normalizedResponse = {
      validationId: "v1",
      processName: "Proceso de prueba",
      environmentName: "Env recheck",
      templateName: null,
      status: "COMPLETED",
      rawStatus: "COMPLETED",
      result: "APPROVED",
      rawResult: "APPROVED",
      client: { name: null, nameMasked: "***", email: null, emailMasked: "***", phone: null },
      clientDetails: null,
      steps: [],
      documentChecks: [],
      documentCheckRejection: null,
      governmentValidation: null,
      naatCheckResult: null,
      naatCheckRecheckResult: null,
      mediaAssets: [
        { id: "captureId:ID_VA_FRONT", stepKey: "captureId", label: "ID_VA_FRONT", mimeType: "image/jpeg", dataUrl: "data:image/jpeg;base64,ZmFrZS1mcm9udC1pbWFnZQ==" },
        { id: "captureId:ID_VA_BACK", stepKey: "captureId", label: "ID_VA_BACK", mimeType: "image/jpeg", dataUrl: "data:image/jpeg;base64,ZmFrZS1iYWNrLWltYWdl" },
        { id: "liveness:selfie", stepKey: "liveness", label: "selfie", mimeType: "image/jpeg", dataUrl: "data:image/jpeg;base64,ZmFrZS1zZWxmaWU=" },
      ],
      raw: { createResponse: null, stepResponse: null, dataResponse: null },
    };

    const execution = await prisma.validationExecution.create({
      data: {
        validationId: "v1",
        processName: "Proceso de prueba",
        environmentId,
        requestPayload: toJsonField({
          processName: "Proceso de prueba",
          validity: 1,
          client: { name: "Cliente Prueba", mail: "cliente@example.com", phone: "+573001234567" },
          steps: {},
          customization: { theme: [], header: [] },
          feature: {},
          notifications: { email: false, whatsapp: false },
        }),
        normalizedResponse: toJsonField(normalizedResponse),
        clientNameMasked: "P*****",
        clientEmailMasked: "c****@example.com",
        isDemo: false,
      },
    });
    return execution.id;
  }

  it("solo envía las imágenes del paso captureId (no selfie/liveness) y guarda el resultado en la ejecución", async () => {
    const executionId = await createFixtureExecution();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { access_token: "tok", token_type: "bearer", expires_in: 43199 }))
      .mockResolvedValueOnce(
        jsonResponse(200, { success: true, error: null, code: 200, data: { risk: "MEDIUM", key: "TEMP_DATA_RISK", result: false } }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const res = await request(app).post(`/api/executions/${executionId}/naat-check`).set("Cookie", adminCookie);
    expect(res.status).toBe(200);
    expect(res.body.result).toMatchObject({ risk: "MEDIUM", key: "TEMP_DATA_RISK", result: false });

    const [, composeInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    const sentBody = JSON.parse(composeInit.body as string);
    expect(sentBody.files).toHaveLength(2);
    expect(sentBody.files.map((f: { name: string }) => f.name)).toEqual(["ID_VA_FRONT", "ID_VA_BACK"]);

    const updated = await prisma.validationExecution.findUniqueOrThrow({ where: { id: executionId } });
    expect(updated.naatCheckRecheckResult).not.toBeNull();

    const detailRes = await request(app).get(`/api/executions/${executionId}`).set("Cookie", adminCookie);
    const documentChecks = detailRes.body.execution.normalized.documentChecks;
    expect(documentChecks).toContainEqual(
      expect.objectContaining({ category: "naatCheckRecheck", result: "RISK_MEDIUM" }),
    );
  });

  it("rechaza cuando NAAT-CHECK no está habilitado para el ambiente", async () => {
    const executionId = await createFixtureExecution();
    await prisma.naatCheckConfig.update({ where: { environmentId }, data: { enabled: false } });
    const res = await request(app).post(`/api/executions/${executionId}/naat-check`).set("Cookie", adminCookie);
    expect(res.status).toBe(400);
  });

  it("propaga un error real cuando NAAT-CHECK falla (nunca fabrica un resultado)", async () => {
    const executionId = await createFixtureExecution();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { access_token: "tok", token_type: "bearer", expires_in: 43199 }))
      .mockResolvedValueOnce(jsonResponse(500, { success: false, error: "Internal error", code: 500 }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await request(app).post(`/api/executions/${executionId}/naat-check`).set("Cookie", adminCookie);
    expect(res.status).toBe(502);
    expect(res.body.error.message).toContain("Internal error");
  });
});

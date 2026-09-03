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

describe("POST /api/executions/:id/sync — pasos administrativos con null no deben dejar los pasos reales en PENDING (confirmado con un log real de FAD)", () => {
  let cookie: string;
  let environmentId: string;
  let executionId: string;

  beforeAll(async () => {
    await prisma.validationStepExecution.deleteMany();
    await prisma.validationExecution.deleteMany();
    await prisma.apiEnvironment.deleteMany();
    await prisma.user.deleteMany();

    await request(app).post("/api/auth/bootstrap/admin").send({
      name: "Admin de Prueba",
      email: "admin.sync@example.com",
      password: "SuperSegura123!",
    });
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin.sync@example.com", password: "SuperSegura123!" });
    cookie = login.headers["set-cookie"];

    const environment = await prisma.apiEnvironment.create({
      data: {
        name: "Env de prueba sync",
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
        validationId: "demo-validation-id",
        processName: "Prueba sincronización",
        environmentId,
        requestPayload: toJsonField({ client: { name: "PRUEBA" }, steps: { privacyNotice: { order: 1, show: true }, captureId: { order: 2, show: true } } }),
        normalizedResponse: null,
        clientNameMasked: "P*****",
        clientEmailMasked: "p***@example.com",
        isDemo: false,
      },
    });
    executionId = execution.id;

    // Estado inicial: pasos ya creados en PENDING (como al crear la validación), reproduciendo el
    // reporte real de "el Pasos tab se queda en PENDING y no actualiza".
    await prisma.validationStepExecution.create({
      data: { validationExecutionId: executionId, stepKey: "privacyNotice", order: 1, status: "PENDING" },
    });
    await prisma.validationStepExecution.create({
      data: { validationExecutionId: executionId, stepKey: "captureId", order: 2, status: "PENDING" },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("tras sincronizar, los pasos reales completados dejan de mostrarse en PENDING", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { access_token: "tok-sync", token_type: "bearer", expires_in: 3600 }))
      // getValidationStep: forma real reportada — pasos administrativos con status/configuration/
      // features en null, junto a pasos reales ya completados.
      .mockResolvedValueOnce(
        jsonResponse(200, {
          processName: "PRUEBA",
          validation: { idProcess: "demo-validation-id", status: "FINISHED" },
          client: { name: "PRUEBA", mail: "p@example.com", phone: "123", photo: null },
          steps: {
            instructionsPermissions: { id: null, order: 0, status: null, show: true, configuration: null, features: null, input: null, data: null },
            privacyNotice: { id: "p1", order: 1, status: "COMPLETED", show: true, configuration: {}, features: {}, data: null },
            captureId: { id: "c1", order: 2, status: "COMPLETED", show: true, configuration: {}, features: { provider: 1 }, data: { ocr: [], alerts: {} } },
            processCompleted: { id: null, order: 5, status: null, show: true, configuration: null, features: null, input: null, data: null },
          },
        }),
      )
      // getValidationData
      .mockResolvedValueOnce(
        jsonResponse(200, {
          success: true,
          error: "",
          code: null,
          data: { client: { nombre: "PRUEBA" }, status: "FINISHED", idValidation: "demo-validation-id" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const res = await request(app).post(`/api/executions/${executionId}/sync`).set("Cookie", cookie);
    expect(res.status).toBe(200);

    const steps: Array<{ stepKey: string; status: string }> = res.body.execution.steps;
    const privacyNotice = steps.find((s) => s.stepKey === "privacyNotice");
    const captureId = steps.find((s) => s.stepKey === "captureId");
    expect(privacyNotice?.status).toBe("COMPLETED");
    expect(captureId?.status).toBe("COMPLETED");
  });
});

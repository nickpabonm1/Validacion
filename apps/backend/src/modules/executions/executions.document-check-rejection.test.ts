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

/** 3 checks OK + 1 ERROR en `textCrossChecks` = 75% de concordancia (peso neutro, sin config de
 * categorías) — misma forma real confirmada en `validation-detail.ts` (`pushFlatDocumentChecks`). */
function stepResponseWith75PercentDocumentChecks(validationId: string) {
  return jsonResponse(200, {
    processName: "PRUEBA",
    validation: { idProcess: validationId, status: "FINISHED" },
    client: { name: "PRUEBA", mail: "p@example.com", phone: "123", photo: null },
    steps: {
      captureId: {
        id: "c1",
        order: 1,
        status: "COMPLETED",
        show: true,
        configuration: {},
        features: { provider: 1 },
        data: {
          alerts: {
            textCrossChecks: [
              { type: { name: "Nombre" }, result: { name: "OK" } },
              { type: { name: "Apellido" }, result: { name: "OK" } },
              { type: { name: "Documento" }, result: { name: "OK" } },
              { type: { name: "Fecha nacimiento" }, result: { name: "ERROR" } },
            ],
          },
        },
      },
    },
  });
}

/** Reproduce el caso real reportado: TODOS los checks vienen como "WAS_NOT_DONE" (el proveedor no
 * ejecutó ninguna verificación cruzada para este documento). */
function stepResponseWithAllChecksNotDone(validationId: string) {
  return jsonResponse(200, {
    processName: "PRUEBA",
    validation: { idProcess: validationId, status: "FINISHED" },
    client: { name: "PRUEBA", mail: "p@example.com", phone: "123", photo: null },
    steps: {
      captureId: {
        id: "c1",
        order: 1,
        status: "COMPLETED",
        show: true,
        configuration: {},
        features: { provider: 1 },
        data: {
          alerts: {
            textCrossChecks: [
              { type: { name: "Apellidos y nombres" }, result: { name: "WAS_NOT_DONE" } },
              { type: { name: "Fecha de nacimiento" }, result: { name: "WAS_NOT_DONE" } },
            ],
            dateChecks: [{ type: { name: "Fecha de vencimiento" }, result: { name: "WAS_NOT_DONE" } }],
          },
        },
      },
    },
  });
}

async function setup(processName: string) {
  const environment = await prisma.apiEnvironment.create({
    data: {
      name: `Env ${processName}`,
      environmentType: "UATHA",
      baseUrl: "https://fad.test.invalid",
      basicAuthUsernameEnc: credentialEncryptionService.encrypt("basic-user"),
      basicAuthPasswordEnc: credentialEncryptionService.encrypt("basic-pass"),
      apiUsernameEnc: credentialEncryptionService.encrypt("api-user"),
      apiPasswordEnc: credentialEncryptionService.encrypt("api-pass"),
      passwordIsPreHashed: true,
    },
  });
  clearCachedToken(environment.id);

  const validationId = `validation-${processName}`;
  const execution = await prisma.validationExecution.create({
    data: {
      validationId,
      processName,
      environmentId: environment.id,
      requestPayload: toJsonField({ client: { name: "PRUEBA" }, steps: { captureId: { order: 1, show: true } } }),
      normalizedResponse: null,
      clientNameMasked: "P*****",
      clientEmailMasked: "p***@example.com",
      isDemo: false,
    },
  });
  await prisma.validationStepExecution.create({
    data: { validationExecutionId: execution.id, stepKey: "captureId", order: 1, status: "PENDING" },
  });
  return { executionId: execution.id, validationId };
}

function mockFadResponses(validationId: string, stepResponse: Response = stepResponseWith75PercentDocumentChecks(validationId)) {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(jsonResponse(200, { access_token: "tok", token_type: "bearer", expires_in: 3600 }))
    .mockResolvedValueOnce(stepResponse)
    .mockResolvedValueOnce(
      jsonResponse(200, { success: true, error: "", code: null, data: { client: { nombre: "PRUEBA" }, status: "FINISHED", idValidation: validationId } }),
    );
  vi.stubGlobal("fetch", fetchMock);
}

describe("Rechazo automático por no concordancia documental (Validación de ID < umbral configurado)", () => {
  let adminCookie: string;

  beforeAll(async () => {
    await prisma.validationStepExecution.deleteMany();
    await prisma.validationExecution.deleteMany();
    await prisma.apiEnvironment.deleteMany();
    await prisma.user.deleteMany();
    await prisma.documentCheckScoringConfig.deleteMany();

    await request(app).post("/api/auth/bootstrap/admin").send({
      name: "Admin de Prueba",
      email: "admin.docreject@example.com",
      password: "SuperSegura123!",
    });
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin.docreject@example.com", password: "SuperSegura123!" });
    adminCookie = login.headers["set-cookie"];
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("con umbral 80% configurado y un 75% calculado, el proceso queda REJECTED con el motivo documentado", async () => {
    await request(app)
      .put("/api/document-check-scoring")
      .set("Cookie", adminCookie)
      .send({ categoryWeights: {}, passThreshold: 80 });

    const { executionId, validationId } = await setup("rechazo-80");
    mockFadResponses(validationId);

    const res = await request(app).post(`/api/executions/${executionId}/sync`).set("Cookie", adminCookie);
    expect(res.status).toBe(200);
    expect(res.body.execution.result).toBe("REJECTED");
    expect(res.body.execution.normalized.documentCheckRejection).toEqual({ percentage: 75, threshold: 80 });
    expect(res.body.execution.normalized.rawResult).toBeNull(); // FAD no reportó un resultado propio; el rechazo es de esta consola
  });

  it("con umbral 70% configurado y un 75% calculado, el proceso NO se rechaza automáticamente", async () => {
    await request(app)
      .put("/api/document-check-scoring")
      .set("Cookie", adminCookie)
      .send({ categoryWeights: {}, passThreshold: 70 });

    const { executionId, validationId } = await setup("aprueba-70");
    mockFadResponses(validationId);

    const res = await request(app).post(`/api/executions/${executionId}/sync`).set("Cookie", adminCookie);
    expect(res.status).toBe(200);
    expect(res.body.execution.result).not.toBe("REJECTED");
    expect(res.body.execution.normalized.documentCheckRejection).toBeNull();
  });

  it("sin umbral configurado (passThreshold null), nunca se rechaza automáticamente aunque el porcentaje sea bajo", async () => {
    await request(app)
      .put("/api/document-check-scoring")
      .set("Cookie", adminCookie)
      .send({ categoryWeights: {}, passThreshold: null });

    const { executionId, validationId } = await setup("sin-umbral");
    mockFadResponses(validationId);

    const res = await request(app).post(`/api/executions/${executionId}/sync`).set("Cookie", adminCookie);
    expect(res.status).toBe(200);
    expect(res.body.execution.result).not.toBe("REJECTED");
    expect(res.body.execution.normalized.documentCheckRejection).toBeNull();
  });

  it("con TODOS los checks WAS_NOT_DONE y treatNotDoneAsFailure en false (por defecto), NO se rechaza — no hay nada evaluado sobre lo cual decidir", async () => {
    await request(app)
      .put("/api/document-check-scoring")
      .set("Cookie", adminCookie)
      .send({ categoryWeights: {}, passThreshold: 70, treatNotDoneAsFailure: false });

    const { executionId, validationId } = await setup("todos-no-realizado-neutro");
    mockFadResponses(validationId, stepResponseWithAllChecksNotDone(validationId));

    const res = await request(app).post(`/api/executions/${executionId}/sync`).set("Cookie", adminCookie);
    expect(res.status).toBe(200);
    expect(res.body.execution.result).not.toBe("REJECTED");
    expect(res.body.execution.normalized.documentCheckRejection).toBeNull();
  });

  it("con TODOS los checks WAS_NOT_DONE y treatNotDoneAsFailure activo, SÍ se rechaza (0% de concordancia)", async () => {
    await request(app)
      .put("/api/document-check-scoring")
      .set("Cookie", adminCookie)
      .send({ categoryWeights: {}, passThreshold: 70, treatNotDoneAsFailure: true });

    const { executionId, validationId } = await setup("todos-no-realizado-fallo");
    mockFadResponses(validationId, stepResponseWithAllChecksNotDone(validationId));

    const res = await request(app).post(`/api/executions/${executionId}/sync`).set("Cookie", adminCookie);
    expect(res.status).toBe(200);
    expect(res.body.execution.result).toBe("REJECTED");
    expect(res.body.execution.normalized.documentCheckRejection).toEqual({ percentage: 0, threshold: 70 });
  });
});

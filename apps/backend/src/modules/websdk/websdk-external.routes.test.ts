import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../app";
import { prisma } from "../../lib/prisma";

const app = createApp();

async function login(email: string, password = "SuperSegura123!"): Promise<string> {
  const res = await request(app).post("/api/auth/login").send({ email, password });
  return res.headers["set-cookie"];
}

describe("websdk-external.routes: API pública para que un sistema externo cree validaciones Web SDK", () => {
  let adminCookie: string;
  let webSdkEnvironmentId: string;
  let apiByStepsEnvironmentId: string;

  beforeAll(async () => {
    await prisma.webSdkShareLink.deleteMany();
    await prisma.validationExecution.deleteMany();
    await prisma.webSdkConfig.deleteMany();
    await prisma.apiEnvironment.deleteMany();
    await prisma.user.deleteMany();

    await request(app).post("/api/auth/bootstrap/admin").send({
      name: "Admin de Prueba",
      email: "admin.websdkexternal@example.com",
      password: "SuperSegura123!",
    });
    adminCookie = await login("admin.websdkexternal@example.com");

    const webSdkRes = await request(app)
      .post("/api/environments")
      .set("Cookie", adminCookie)
      .send({
        name: "Env Web SDK externo",
        environmentType: "UATHA",
        baseUrl: "https://fad.test.invalid",
        integrationModel: "WEB_SDK",
      });
    webSdkEnvironmentId = webSdkRes.body.environment.id;
    await prisma.webSdkConfig.create({ data: { environmentId: webSdkEnvironmentId } });

    const byStepsRes = await request(app)
      .post("/api/environments")
      .set("Cookie", adminCookie)
      .send({ name: "Env API-by-steps", environmentType: "UATHA", baseUrl: "https://fad2.test.invalid" });
    apiByStepsEnvironmentId = byStepsRes.body.environment.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("un ambiente nuevo no tiene clave de API externa configurada", async () => {
    const res = await request(app).get(`/api/environments/${webSdkEnvironmentId}`).set("Cookie", adminCookie);
    expect(res.body.environment.externalApiKey).toEqual({
      configured: false,
      prefix: null,
      createdAt: null,
      lastUsedAt: null,
    });
  });

  it("rechaza generar una clave de API externa sobre un ambiente API_BY_STEPS", async () => {
    const res = await request(app)
      .post(`/api/environments/${apiByStepsEnvironmentId}/external-api-key`)
      .set("Cookie", adminCookie)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/Web SDK/i);
  });

  it("genera una clave de API externa: la clave real solo viaja en la respuesta de creación", async () => {
    const genRes = await request(app)
      .post(`/api/environments/${webSdkEnvironmentId}/external-api-key`)
      .set("Cookie", adminCookie)
      .send({});
    expect(genRes.status).toBe(201);
    expect(genRes.body.apiKey.rawKey).toMatch(/^wsk_live_/);
    expect(genRes.body.apiKey.configured).toBe(true);
    expect(genRes.body.apiKey.prefix).toContain("wsk_live_");

    const envRes = await request(app).get(`/api/environments/${webSdkEnvironmentId}`).set("Cookie", adminCookie);
    expect(envRes.body.environment.externalApiKey.configured).toBe(true);
    // El listado del ambiente nunca vuelve a exponer la clave completa, solo el prefijo.
    expect(JSON.stringify(envRes.body)).not.toContain(genRes.body.apiKey.rawKey);
  });

  it("un sistema externo sin clave (o con una clave equivocada) recibe 401, nunca crea nada", async () => {
    const noAuthRes = await request(app)
      .post("/api/public/websdk-validations")
      .send({ client: { name: "Cliente Externo", mail: "externo@ejemplo.com", phone: "+573000000001" } });
    expect(noAuthRes.status).toBe(401);

    const wrongKeyRes = await request(app)
      .post("/api/public/websdk-validations")
      .set("Authorization", "Bearer wsk_live_clave-que-no-existe")
      .send({ client: { name: "Cliente Externo", mail: "externo@ejemplo.com", phone: "+573000000001" } });
    expect(wrongKeyRes.status).toBe(401);
  });

  it("crea una validación con la clave de API y permite consultar su estado — flujo completo", async () => {
    const genRes = await request(app)
      .post(`/api/environments/${webSdkEnvironmentId}/external-api-key`)
      .set("Cookie", adminCookie)
      .send({});
    const rawKey: string = genRes.body.apiKey.rawKey;

    const createRes = await request(app)
      .post("/api/public/websdk-validations")
      .set("Authorization", `Bearer ${rawKey}`)
      .send({
        processName: "Onboarding externo",
        client: { name: "Cliente Externo", mail: "externo@ejemplo.com", phone: "+573000000001" },
      });
    expect(createRes.status).toBe(201);
    expect(createRes.body.validation.status).toBe("PENDING");
    expect(createRes.body.validation.publicUrl).toMatch(/\/v\//);
    expect(createRes.body.validation.token).toBeTruthy();

    const statusRes = await request(app)
      .get(`/api/public/websdk-validations/${createRes.body.validation.id}`)
      .set("Authorization", `Bearer ${rawKey}`);
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.validation).toMatchObject({
      id: createRes.body.validation.id,
      status: "PENDING",
      executionId: null,
      normalizedStatus: null,
      result: null,
    });

    // La ejecución que se crea al final no queda atribuida a ningún operador de la consola.
    const linkRow = await prisma.webSdkShareLink.findUnique({ where: { id: createRes.body.validation.id } });
    expect(linkRow?.createdById).toBeNull();
  });

  it("la clave de un ambiente no puede consultar el estado de una validación de otro ambiente", async () => {
    const genA = await request(app)
      .post(`/api/environments/${webSdkEnvironmentId}/external-api-key`)
      .set("Cookie", adminCookie)
      .send({});
    const keyA: string = genA.body.apiKey.rawKey;

    const otherEnvRes = await request(app)
      .post("/api/environments")
      .set("Cookie", adminCookie)
      .send({ name: "Otro ambiente Web SDK", environmentType: "UATHA", baseUrl: "https://fad3.test.invalid", integrationModel: "WEB_SDK" });
    const otherEnvironmentId = otherEnvRes.body.environment.id;
    await prisma.webSdkConfig.create({ data: { environmentId: otherEnvironmentId } });
    const genB = await request(app)
      .post(`/api/environments/${otherEnvironmentId}/external-api-key`)
      .set("Cookie", adminCookie)
      .send({});
    const keyB: string = genB.body.apiKey.rawKey;

    const createRes = await request(app)
      .post("/api/public/websdk-validations")
      .set("Authorization", `Bearer ${keyA}`)
      .send({ client: { name: "Cliente A", mail: "a@ejemplo.com", phone: "+573000000002" } });

    const crossRes = await request(app)
      .get(`/api/public/websdk-validations/${createRes.body.validation.id}`)
      .set("Authorization", `Bearer ${keyB}`);
    expect(crossRes.status).toBe(404);
  });

  it("revocar la clave hace que deje de autenticar de inmediato", async () => {
    const genRes = await request(app)
      .post(`/api/environments/${webSdkEnvironmentId}/external-api-key`)
      .set("Cookie", adminCookie)
      .send({});
    const rawKey: string = genRes.body.apiKey.rawKey;

    const revokeRes = await request(app)
      .delete(`/api/environments/${webSdkEnvironmentId}/external-api-key`)
      .set("Cookie", adminCookie);
    expect(revokeRes.status).toBe(200);
    expect(revokeRes.body.environment.externalApiKey.configured).toBe(false);

    const afterRevokeRes = await request(app)
      .post("/api/public/websdk-validations")
      .set("Authorization", `Bearer ${rawKey}`)
      .send({ client: { name: "Cliente", mail: "c@ejemplo.com", phone: "+573000000003" } });
    expect(afterRevokeRes.status).toBe(401);
  });
});

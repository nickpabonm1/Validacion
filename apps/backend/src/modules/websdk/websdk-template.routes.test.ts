import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../app";
import { prisma } from "../../lib/prisma";

const app = createApp();

async function login(email: string, password = "SuperSegura123!"): Promise<string> {
  const res = await request(app).post("/api/auth/login").send({ email, password });
  return res.headers["set-cookie"];
}

describe("websdk-template.routes: CRUD de plantillas Web SDK", () => {
  let adminCookie: string;
  let webSdkEnvironmentId: string;
  let apiByStepsEnvironmentId: string;

  beforeAll(async () => {
    await prisma.webSdkShareLink.deleteMany();
    await prisma.validationExecution.deleteMany();
    await prisma.webSdkTemplate.deleteMany();
    await prisma.webSdkConfig.deleteMany();
    await prisma.apiEnvironment.deleteMany();
    await prisma.user.deleteMany();

    await request(app).post("/api/auth/bootstrap/admin").send({
      name: "Admin de Prueba",
      email: "admin.websdktemplate@example.com",
      password: "SuperSegura123!",
    });
    adminCookie = await login("admin.websdktemplate@example.com");

    const webSdkRes = await request(app)
      .post("/api/environments")
      .set("Cookie", adminCookie)
      .send({ name: "Env Web SDK plantillas", environmentType: "UATHA", baseUrl: "https://fad.test.invalid", integrationModel: "WEB_SDK" });
    webSdkEnvironmentId = webSdkRes.body.environment.id;

    const byStepsRes = await request(app)
      .post("/api/environments")
      .set("Cookie", adminCookie)
      .send({ name: "Env API-by-steps", environmentType: "UATHA", baseUrl: "https://fad2.test.invalid" });
    apiByStepsEnvironmentId = byStepsRes.body.environment.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("GET / exige el query param environmentId", async () => {
    const res = await request(app).get("/api/websdk-templates").set("Cookie", adminCookie);
    expect(res.status).toBe(400);
  });

  it("GET / devuelve lista vacía para un ambiente sin plantillas", async () => {
    const res = await request(app)
      .get(`/api/websdk-templates?environmentId=${webSdkEnvironmentId}`)
      .set("Cookie", adminCookie);
    expect(res.status).toBe(200);
    expect(res.body.templates).toEqual([]);
  });

  it("rechaza crear una plantilla sobre un ambiente API_BY_STEPS", async () => {
    const res = await request(app)
      .post("/api/websdk-templates")
      .set("Cookie", adminCookie)
      .send({ name: "X", environmentId: apiByStepsEnvironmentId });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/Web SDK/i);
  });

  it("crea, lee, actualiza y borra una plantilla — nunca fabrica umbrales: quedan null si no se envían", async () => {
    const createRes = await request(app)
      .post("/api/websdk-templates")
      .set("Cookie", adminCookie)
      .send({
        name: "Apertura de cuenta",
        description: "Onboarding para apertura de cuenta",
        environmentId: webSdkEnvironmentId,
        onboardingMessages: { welcomeTitle: "Bienvenido a tu nueva cuenta" },
        customization: { colors: { primary: "#123456" } },
      });
    expect(createRes.status).toBe(201);
    expect(createRes.body.template).toMatchObject({
      name: "Apertura de cuenta",
      environmentId: webSdkEnvironmentId,
      active: true,
      onboardingMessages: { welcomeTitle: "Bienvenido a tu nueva cuenta" },
      customization: { colors: { primary: "#123456" } },
      checkMaxAttempts: null,
      checkAcceptedRisk: null,
      faceMatchMinConfidence: null,
    });
    const templateId = createRes.body.template.id;

    const listRes = await request(app)
      .get(`/api/websdk-templates?environmentId=${webSdkEnvironmentId}`)
      .set("Cookie", adminCookie);
    expect(listRes.body.templates).toHaveLength(1);

    const getRes = await request(app).get(`/api/websdk-templates/${templateId}`).set("Cookie", adminCookie);
    expect(getRes.status).toBe(200);
    expect(getRes.body.template.id).toBe(templateId);

    const updateRes = await request(app)
      .put(`/api/websdk-templates/${templateId}`)
      .set("Cookie", adminCookie)
      .send({
        name: "Apertura de cuenta (v2)",
        environmentId: webSdkEnvironmentId,
        active: false,
        checkMaxAttempts: 5,
        checkAcceptedRisk: "MEDIUM",
        faceMatchMinConfidence: 70,
      });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.template).toMatchObject({
      name: "Apertura de cuenta (v2)",
      active: false,
      checkMaxAttempts: 5,
      checkAcceptedRisk: "MEDIUM",
      faceMatchMinConfidence: 70,
      // Al no reenviar onboardingMessages/customization, quedan en su default vacío — no se
      // "recuerda" el valor anterior a medias, el operador ve exactamente lo que hay.
      onboardingMessages: {},
      customization: {},
    });

    const deleteRes = await request(app).delete(`/api/websdk-templates/${templateId}`).set("Cookie", adminCookie);
    expect(deleteRes.status).toBe(204);

    const afterDeleteRes = await request(app).get(`/api/websdk-templates/${templateId}`).set("Cookie", adminCookie);
    expect(afterDeleteRes.status).toBe(404);
  });

  it("rechaza operar sin sesión", async () => {
    const res = await request(app).get(`/api/websdk-templates?environmentId=${webSdkEnvironmentId}`);
    expect(res.status).toBe(401);
  });
});

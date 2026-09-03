import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../app";
import { prisma } from "../../lib/prisma";
import { hashPassword } from "../auth/password";

const app = createApp();

describe("document-check-scoring.routes: lectura para cualquier rol, escritura solo ADMIN", () => {
  let adminCookie: string;
  let operatorCookie: string;

  beforeAll(async () => {
    await prisma.documentCheckScoringConfig.deleteMany();
    await prisma.user.deleteMany();

    await request(app).post("/api/auth/bootstrap/admin").send({
      name: "Admin de Prueba",
      email: "admin.scoring@example.com",
      password: "SuperSegura123!",
    });
    const adminLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin.scoring@example.com", password: "SuperSegura123!" });
    adminCookie = adminLogin.headers["set-cookie"];

    await prisma.user.create({
      data: {
        name: "Operador de Prueba",
        email: "operator.scoring@example.com",
        passwordHash: await hashPassword("SuperSegura123!"),
        role: "OPERATOR",
        active: true,
      },
    });
    const operatorLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "operator.scoring@example.com", password: "SuperSegura123!" });
    operatorCookie = operatorLogin.headers["set-cookie"];
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("rechaza peticiones sin sesión", async () => {
    const res = await request(app).get("/api/document-check-scoring");
    expect(res.status).toBe(401);
  });

  it("un OPERATOR puede leer la configuración (el reporte la necesita para puntuar)", async () => {
    const res = await request(app).get("/api/document-check-scoring").set("Cookie", operatorCookie);
    expect(res.status).toBe(200);
    expect(res.body.documentCheckScoringConfig.passThreshold).toBeNull();
    expect(res.body.documentCheckScoringConfig.treatNotDoneAsFailure).toBe(false); // por defecto, sin configurar
  });

  it("un OPERATOR NO puede modificar la configuración", async () => {
    const res = await request(app)
      .put("/api/document-check-scoring")
      .set("Cookie", operatorCookie)
      .send({ categoryWeights: { authenticity: 100 }, passThreshold: 90 });
    expect(res.status).toBe(403);
  });

  it("un ADMIN puede modificar la configuración y la lectura posterior refleja el cambio", async () => {
    const putRes = await request(app)
      .put("/api/document-check-scoring")
      .set("Cookie", adminCookie)
      .send({ categoryWeights: { authenticity: 80, imageQuality: 20 }, passThreshold: 90, treatNotDoneAsFailure: true });
    expect(putRes.status).toBe(200);
    expect(putRes.body.documentCheckScoringConfig.passThreshold).toBe(90);
    expect(putRes.body.documentCheckScoringConfig.treatNotDoneAsFailure).toBe(true);

    const getRes = await request(app).get("/api/document-check-scoring").set("Cookie", operatorCookie);
    expect(getRes.body.documentCheckScoringConfig.categoryWeights).toEqual({ authenticity: 80, imageQuality: 20 });
    expect(getRes.body.documentCheckScoringConfig.treatNotDoneAsFailure).toBe(true);
  });

  it("GET /known-features expone los nombres de característica ya observados, agrupados por categoría", async () => {
    const res = await request(app).get("/api/document-check-scoring/known-features").set("Cookie", operatorCookie);
    expect(res.status).toBe(200);
    expect(res.body.knownFeatures).toEqual(expect.any(Object));
  });

  it("rechaza pesos de categoría que no suman 100% (incompletos)", async () => {
    const res = await request(app)
      .put("/api/document-check-scoring")
      .set("Cookie", adminCookie)
      .send({ categoryWeights: { authenticity: 40, imageQuality: 20 }, passThreshold: null });
    expect(res.status).toBe(400);
  });

  it("rechaza pesos de categoría que superan 100% en total", async () => {
    const res = await request(app)
      .put("/api/document-check-scoring")
      .set("Cookie", adminCookie)
      .send({ categoryWeights: { authenticity: 80, imageQuality: 40 }, passThreshold: null });
    expect(res.status).toBe(400);
  });

  it("rechaza subpesos de característica dentro de una categoría que no suman 100%", async () => {
    const res = await request(app)
      .put("/api/document-check-scoring")
      .set("Cookie", adminCookie)
      .send({
        categoryWeights: { authenticity: 100 },
        featureWeights: { authenticity: { hologram: 50, microprint: 30 } },
        passThreshold: null,
      });
    expect(res.status).toBe(400);
  });

  it("acepta y guarda subpesos de característica que suman 100% dentro de una categoría", async () => {
    const res = await request(app)
      .put("/api/document-check-scoring")
      .set("Cookie", adminCookie)
      .send({
        categoryWeights: { authenticity: 100 },
        featureWeights: { authenticity: { hologram: 60, microprint: 40 } },
        passThreshold: null,
      });
    expect(res.status).toBe(200);
    expect(res.body.documentCheckScoringConfig.featureWeights).toEqual({ authenticity: { hologram: 60, microprint: 40 } });
  });

  it("una categoría desactivada (peso 0) no cuenta para la validación de suma 100%", async () => {
    const res = await request(app)
      .put("/api/document-check-scoring")
      .set("Cookie", adminCookie)
      .send({ categoryWeights: { authenticity: 100, imageQuality: 0 }, passThreshold: null });
    expect(res.status).toBe(200);
  });
});

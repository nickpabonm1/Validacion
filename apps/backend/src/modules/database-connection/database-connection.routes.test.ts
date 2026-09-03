import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../app";
import { prisma } from "../../lib/prisma";
import { hashPassword } from "../auth/password";

const app = createApp();

describe("database-connection.routes: solo ADMIN, y 'probar conexión' nunca fabrica un resultado", () => {
  let adminCookie: string;
  let operatorCookie: string;

  beforeAll(async () => {
    await prisma.databaseConnectionConfig.deleteMany();
    await prisma.user.deleteMany();

    await request(app).post("/api/auth/bootstrap/admin").send({
      name: "Admin de Prueba",
      email: "admin.dbconn@example.com",
      password: "SuperSegura123!",
    });
    const adminLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin.dbconn@example.com", password: "SuperSegura123!" });
    adminCookie = adminLogin.headers["set-cookie"];

    await prisma.user.create({
      data: {
        name: "Operador de Prueba",
        email: "operator.dbconn@example.com",
        passwordHash: await hashPassword("SuperSegura123!"),
        role: "OPERATOR",
        active: true,
      },
    });
    const operatorLogin = await request(app)
      .post("/api/auth/login")
      .send({ email: "operator.dbconn@example.com", password: "SuperSegura123!" });
    operatorCookie = operatorLogin.headers["set-cookie"];
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("rechaza peticiones sin sesión", async () => {
    const res = await request(app).get("/api/database-connection");
    expect(res.status).toBe(401);
  });

  it("un OPERATOR no puede leer ni escribir la configuración de base de datos", async () => {
    const getRes = await request(app).get("/api/database-connection").set("Cookie", operatorCookie);
    expect(getRes.status).toBe(403);

    const putRes = await request(app)
      .put("/api/database-connection")
      .set("Cookie", operatorCookie)
      .send({ targetEngine: "POSTGRESQL", ssl: true });
    expect(putRes.status).toBe(403);
  });

  it("un ADMIN lee el motor activo (SQLITE en pruebas) y el motor objetivo por defecto", async () => {
    const res = await request(app).get("/api/database-connection").set("Cookie", adminCookie);
    expect(res.status).toBe(200);
    expect(res.body.databaseConnectionConfig.activeEngine).toBe("SQLITE");
  });

  it("un ADMIN guarda una configuración objetivo y la lectura posterior la refleja", async () => {
    const putRes = await request(app)
      .put("/api/database-connection")
      .set("Cookie", adminCookie)
      .send({ targetEngine: "POSTGRESQL", host: "db.example.invalid", port: 5432, databaseName: "fad", username: "app", password: "secreta", ssl: true });
    expect(putRes.status).toBe(200);
    expect(putRes.body.databaseConnectionConfig.targetEngine).toBe("POSTGRESQL");
    expect(putRes.body.databaseConnectionConfig.passwordConfigured).toBe(true);

    const getRes = await request(app).get("/api/database-connection").set("Cookie", adminCookie);
    expect(getRes.body.databaseConnectionConfig.host).toBe("db.example.invalid");
  });

  it("POST /test contra MongoDB responde 'no soportado' en vez de fingir un resultado", async () => {
    const res = await request(app)
      .post("/api/database-connection/test")
      .set("Cookie", adminCookie)
      .send({ targetEngine: "MONGODB", ssl: true });
    expect(res.status).toBe(200);
    expect(res.body.result.supported).toBe(false);
  });

  it("POST /test contra SQLite siempre responde exitosa", async () => {
    const res = await request(app)
      .post("/api/database-connection/test")
      .set("Cookie", adminCookie)
      .send({ targetEngine: "SQLITE", ssl: true });
    expect(res.status).toBe(200);
    expect(res.body.result.ok).toBe(true);
  });
});

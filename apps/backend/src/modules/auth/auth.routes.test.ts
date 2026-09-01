import { beforeAll, afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../app";
import { prisma } from "../../lib/prisma";

const app = createApp();

describe("Auth: bootstrap + login (integración, SQLite de prueba)", () => {
  beforeAll(async () => {
    await prisma.auditLog.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("reporta needsBootstrap=true cuando no hay usuarios", async () => {
    const res = await request(app).get("/api/auth/bootstrap/status");
    expect(res.status).toBe(200);
    expect(res.body.needsBootstrap).toBe(true);
  });

  it("crea el primer administrador y establece sesión", async () => {
    const res = await request(app).post("/api/auth/bootstrap/admin").send({
      name: "Admin de Prueba",
      email: "admin.test@example.com",
      password: "SuperSegura123!",
    });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe("ADMIN");
    expect(res.headers["set-cookie"]).toBeDefined();
  });

  it("rechaza un segundo bootstrap una vez que existe un usuario", async () => {
    const res = await request(app).post("/api/auth/bootstrap/admin").send({
      name: "Otro",
      email: "otro@example.com",
      password: "SuperSegura123!",
    });
    expect(res.status).toBe(409);
  });

  it("permite login con credenciales correctas y rechaza incorrectas", async () => {
    const bad = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin.test@example.com", password: "incorrecta" });
    expect(bad.status).toBe(401);

    const good = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin.test@example.com", password: "SuperSegura123!" });
    expect(good.status).toBe(200);
    expect(good.body.user.email).toBe("admin.test@example.com");
  });

  it("expone /me solo con sesión válida", async () => {
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin.test@example.com", password: "SuperSegura123!" });
    const cookie = login.headers["set-cookie"];

    const unauthenticated = await request(app).get("/api/auth/me");
    expect(unauthenticated.status).toBe(401);

    const authenticated = await request(app).get("/api/auth/me").set("Cookie", cookie);
    expect(authenticated.status).toBe(200);
    expect(authenticated.body.user.role).toBe("ADMIN");
  });
});

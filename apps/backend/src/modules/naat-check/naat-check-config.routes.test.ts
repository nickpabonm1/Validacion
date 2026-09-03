import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../../app";
import { prisma } from "../../lib/prisma";

const app = createApp();

async function login(email: string, password = "SuperSegura123!"): Promise<string> {
  const res = await request(app).post("/api/auth/login").send({ email, password });
  return res.headers["set-cookie"];
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("naat-check-config.routes: configuración por ambiente", () => {
  let adminCookie: string;
  let environmentId: string;

  beforeAll(async () => {
    // Borrar ejecuciones ANTES que ambientes: `ValidationExecution.environment` es
    // `onDelete: Restrict`, así que un ambiente con ejecuciones (dejado por otro archivo de
    // prueba que comparte el mismo test.db, dado `fileParallelism: false`) bloquearía este
    // `deleteMany` general si no se limpia primero.
    await prisma.validationExecution.deleteMany();
    await prisma.naatCheckConfig.deleteMany();
    await prisma.apiEnvironment.deleteMany();
    await prisma.user.deleteMany();

    await request(app).post("/api/auth/bootstrap/admin").send({
      name: "Admin de Prueba",
      email: "admin.naatcheckconfig@example.com",
      password: "SuperSegura123!",
    });
    adminCookie = await login("admin.naatcheckconfig@example.com");

    const envRes = await request(app)
      .post("/api/environments")
      .set("Cookie", adminCookie)
      .send({ name: "Env NAAT-CHECK", environmentType: "UATHA", baseUrl: "https://fad.test.invalid" });
    environmentId = envRes.body.environment.id;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("GET devuelve null cuando el ambiente todavía no tiene configuración NAAT-CHECK", async () => {
    const res = await request(app).get(`/api/environments/${environmentId}/naat-check-config`).set("Cookie", adminCookie);
    expect(res.status).toBe(200);
    expect(res.body.naatCheckConfig).toBeNull();
  });

  it("PUT guarda la configuración y nunca expone la contraseña en texto plano", async () => {
    const res = await request(app)
      .put(`/api/environments/${environmentId}/naat-check-config`)
      .set("Cookie", adminCookie)
      .send({
        enabled: true,
        baseUrl: "https://uat.firmaautografa.com",
        username: "usuario@dominio.com",
        password: "clave-secreta",
        acceptedRiskLevel: "MEDIUM",
      });
    expect(res.status).toBe(200);
    expect(res.body.naatCheckConfig.enabled).toBe(true);
    expect(res.body.naatCheckConfig.username).toBe("usuario@dominio.com");
    expect(res.body.naatCheckConfig.passwordConfigured).toBe(true);
    expect(res.body.naatCheckConfig.acceptedRiskLevel).toBe("MEDIUM");
    expect(JSON.stringify(res.body)).not.toContain("clave-secreta");
  });

  it("POST /test hace un intento de autenticación real y reporta el resultado genuino", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(401, { error: "unauthorized_user", error_description: "Bad credentials" }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await request(app)
      .post(`/api/environments/${environmentId}/naat-check-config/test`)
      .set("Cookie", adminCookie)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.result.success).toBe(false);
    expect(res.body.result.message).toContain("Bad credentials");
    expect(fetchMock).toHaveBeenCalledTimes(1); // reutilizó la contraseña ya guardada, sí llamó a la red
  });

  it("POST /test sin credenciales guardadas ni enviadas rechaza sin llamar a la red", async () => {
    await prisma.naatCheckConfig.update({ where: { environmentId }, data: { usernameEnc: null, passwordEnc: null } });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const res = await request(app)
      .post(`/api/environments/${environmentId}/naat-check-config/test`)
      .set("Cookie", adminCookie)
      .send({});
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

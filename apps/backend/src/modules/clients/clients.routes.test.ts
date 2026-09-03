import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../app";
import { prisma } from "../../lib/prisma";
import { hashPassword } from "../auth/password";

const app = createApp();

async function login(email: string, password = "SuperSegura123!"): Promise<string> {
  const res = await request(app).post("/api/auth/login").send({ email, password });
  return res.headers["set-cookie"];
}

describe("Jerarquía de clientes (multi-tenant): aislamiento por subárbol", () => {
  let platformAdminCookie: string;
  let clientAAdminCookie: string;
  let clientAId: string;
  let clientDId: string;

  beforeAll(async () => {
    await prisma.validationExecution.deleteMany();
    await prisma.apiEnvironment.deleteMany();
    await prisma.user.deleteMany();
    await prisma.client.deleteMany();

    await request(app).post("/api/auth/bootstrap/admin").send({
      name: "Admin de Plataforma",
      email: "platform.admin@example.com",
      password: "SuperSegura123!",
    });
    platformAdminCookie = await login("platform.admin@example.com");

    // Cliente A (raíz) creado por el admin de plataforma.
    const clientARes = await request(app).post("/api/clients").set("Cookie", platformAdminCookie).send({ name: "Cliente A" });
    clientAId = clientARes.body.client.id;

    // Cliente D (raíz, sin relación con A) — para probar que A no lo ve ni lo administra.
    const clientDRes = await request(app).post("/api/clients").set("Cookie", platformAdminCookie).send({ name: "Cliente D" });
    clientDId = clientDRes.body.client.id;

    // Usuario ADMIN del cliente A (creado directamente en BD, como haría el bootstrap de un
    // cliente nuevo).
    await prisma.user.create({
      data: {
        name: "Admin de Cliente A",
        email: "admin.clientea@example.com",
        passwordHash: await hashPassword("SuperSegura123!"),
        role: "ADMIN",
        active: true,
        clientId: clientAId,
      },
    });
    clientAAdminCookie = await login("admin.clientea@example.com");
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("un usuario de plataforma (clientId null) ve todos los clientes", async () => {
    const res = await request(app).get("/api/clients").set("Cookie", platformAdminCookie);
    const names = res.body.clients.map((c: { name: string }) => c.name);
    expect(names).toEqual(expect.arrayContaining(["Cliente A", "Cliente D"]));
  });

  it("el admin del cliente A solo ve su propio cliente (nunca al cliente D)", async () => {
    const res = await request(app).get("/api/clients").set("Cookie", clientAAdminCookie);
    const names = res.body.clients.map((c: { name: string }) => c.name);
    expect(names).toEqual(["Cliente A"]);
  });

  it("el admin del cliente A puede crear un hijo, que queda dentro de su propio subárbol", async () => {
    const res = await request(app).post("/api/clients").set("Cookie", clientAAdminCookie).send({ name: "Hijo de A" });
    expect(res.status).toBe(201);
    expect(res.body.client.parentClientId).toBe(clientAId);

    const listRes = await request(app).get("/api/clients").set("Cookie", clientAAdminCookie);
    const names = listRes.body.clients.map((c: { name: string }) => c.name);
    expect(names).toEqual(expect.arrayContaining(["Cliente A", "Hijo de A"]));
  });

  it("el admin del cliente A NO puede crear un hijo bajo el cliente D (fuera de su subárbol)", async () => {
    const res = await request(app)
      .post("/api/clients")
      .set("Cookie", clientAAdminCookie)
      .send({ name: "Intento ajeno", parentClientId: clientDId });
    expect(res.status).toBe(403);
  });

  it("el admin del cliente A NO puede editar el cliente D directamente", async () => {
    const res = await request(app).patch(`/api/clients/${clientDId}`).set("Cookie", clientAAdminCookie).send({ name: "Hackeado" });
    expect(res.status).toBe(403);
  });

  it("el admin del cliente A puede configurar su propia marca (logo/color)", async () => {
    const res = await request(app)
      .put(`/api/clients/${clientAId}/branding`)
      .set("Cookie", clientAAdminCookie)
      .send({ primaryColor: "#1d4ed8" });
    expect(res.status).toBe(200);
    expect(res.body.client.primaryColor).toBe("#1d4ed8");
  });

  it("un usuario del cliente A obtiene su marca vía GET /clients/branding, con el color configurado", async () => {
    const res = await request(app).get("/api/clients/branding").set("Cookie", clientAAdminCookie);
    expect(res.body.branding.clientId).toBe(clientAId);
    expect(res.body.branding.primaryColor).toBe("#1d4ed8");
  });

  it("un usuario de plataforma sin cliente asignado obtiene una marca vacía (usa la marca por defecto de la consola)", async () => {
    const res = await request(app).get("/api/clients/branding").set("Cookie", platformAdminCookie);
    expect(res.body.branding.clientId).toBeNull();
  });

  it("un usuario de plataforma sin cliente usa la plantilla de correo por defecto de la consola", async () => {
    const res = await request(app).get("/api/clients/email-template").set("Cookie", platformAdminCookie);
    expect(res.body.template.isDefault).toBe(true);
    expect(res.body.template.subject).toContain("{{processName}}");
  });

  it("el admin del cliente A NO puede configurar la plantilla de correo del cliente D (fuera de su subárbol)", async () => {
    const res = await request(app)
      .put(`/api/clients/${clientDId}/email-template`)
      .set("Cookie", clientAAdminCookie)
      .send({ emailSubjectTemplate: "Hackeado {{processName}}" });
    expect(res.status).toBe(403);
  });

  it("el admin del cliente A puede configurar su propia plantilla de correo, y su usuario la ve resuelta (sin isDefault)", async () => {
    const putRes = await request(app)
      .put(`/api/clients/${clientAId}/email-template`)
      .set("Cookie", clientAAdminCookie)
      .send({ emailSubjectTemplate: "Bienvenido a {{clientName}}", emailBodyTemplate: "<p>Enlace: {{link}}</p>" });
    expect(putRes.status).toBe(200);
    expect(putRes.body.client.emailSubjectTemplate).toBe("Bienvenido a {{clientName}}");

    const getRes = await request(app).get("/api/clients/email-template").set("Cookie", clientAAdminCookie);
    expect(getRes.body.template.isDefault).toBe(false);
    expect(getRes.body.template.subject).toBe("Bienvenido a {{clientName}}");
  });

  it("un hijo sin plantilla propia hereda la plantilla del cliente A (su padre)", async () => {
    const childRes = await request(app).post("/api/clients").set("Cookie", clientAAdminCookie).send({ name: "Hijo heredero" });
    const childId = childRes.body.client.id;

    await prisma.user.create({
      data: {
        name: "Admin de Hijo heredero",
        email: "admin.hijoheredero@example.com",
        passwordHash: await hashPassword("SuperSegura123!"),
        role: "ADMIN",
        active: true,
        clientId: childId,
      },
    });
    const childCookie = await login("admin.hijoheredero@example.com");

    const res = await request(app).get("/api/clients/email-template").set("Cookie", childCookie);
    expect(res.body.template.isDefault).toBe(false);
    expect(res.body.template.subject).toBe("Bienvenido a {{clientName}}");
  });

  it("borrar la plantilla propia (string vacío) la restaura a heredar/por defecto", async () => {
    const res = await request(app)
      .put(`/api/clients/${clientAId}/email-template`)
      .set("Cookie", clientAAdminCookie)
      .send({ emailSubjectTemplate: "", emailBodyTemplate: "" });
    expect(res.status).toBe(200);
    expect(res.body.client.emailSubjectTemplate).toBeNull();

    const getRes = await request(app).get("/api/clients/email-template").set("Cookie", clientAAdminCookie);
    expect(getRes.body.template.isDefault).toBe(true);
  });

  it("un ambiente creado por el admin del cliente A queda asignado a A, y el admin de A lo ve en su listado", async () => {
    const res = await request(app)
      .post("/api/environments")
      .set("Cookie", clientAAdminCookie)
      .send({ name: "Ambiente de A", environmentType: "UATHA", baseUrl: "https://fad.test.invalid" });
    expect(res.status).toBe(201);
    expect(res.body.environment.clientId).toBe(clientAId);

    const listRes = await request(app).get("/api/environments").set("Cookie", clientAAdminCookie);
    const names = listRes.body.environments.map((e: { name: string }) => e.name);
    expect(names).toContain("Ambiente de A");
  });

  it("el admin del cliente A no ve ambientes de plataforma (clientId null) creados fuera de su subárbol", async () => {
    await request(app)
      .post("/api/environments")
      .set("Cookie", platformAdminCookie)
      .send({ name: "Ambiente de plataforma", environmentType: "UATHA", baseUrl: "https://fad.test.invalid" });

    const res = await request(app).get("/api/environments").set("Cookie", clientAAdminCookie);
    const names = res.body.environments.map((e: { name: string }) => e.name);
    expect(names).not.toContain("Ambiente de plataforma");
  });

  it("el panel de inicio (dashboard) del admin del cliente A no cuenta ejecuciones/ambientes de plataforma ajenos a su subárbol", async () => {
    // Reproduce el hallazgo real: sin este filtro, el conteo total y "últimas validaciones" del
    // dashboard mostraban datos de TODOS los clientes, no solo del propio.
    const platformRes = await request(app).get("/api/settings/dashboard").set("Cookie", platformAdminCookie);
    const clientARes = await request(app).get("/api/settings/dashboard").set("Cookie", clientAAdminCookie);

    // El admin de plataforma ve el ambiente de plataforma creado en la prueba anterior; el admin
    // del cliente A nunca lo ve reflejado en sus totales.
    expect(platformRes.body.stats.environments.some((e: { name: string }) => e.name === "Ambiente de plataforma")).toBe(true);
    expect(clientARes.body.stats.environments.some((e: { name: string }) => e.name === "Ambiente de plataforma")).toBe(false);
  });
});

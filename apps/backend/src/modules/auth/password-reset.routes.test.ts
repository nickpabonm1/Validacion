import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../../app";
import { prisma } from "../../lib/prisma";
import { hashPassword } from "./password";

const sendMailMock = vi.fn().mockResolvedValue({ messageId: "mocked-message-id" });
vi.mock("nodemailer", () => ({
  default: { createTransport: () => ({ sendMail: sendMailMock }) },
}));

const app = createApp();

async function login(email: string, password = "SuperSegura123!"): Promise<string> {
  const res = await request(app).post("/api/auth/login").send({ email, password });
  return res.headers["set-cookie"];
}

function extractTokenFromEmail(): string {
  const sentMail = sendMailMock.mock.calls[sendMailMock.mock.calls.length - 1]![0];
  const match = /\/reset-password\/([A-Za-z0-9_-]+)/.exec(sentMail.html as string);
  if (!match) throw new Error("No se encontró el token en el correo enviado (mock)");
  return match[1]!;
}

describe("Restablecimiento de contraseña por correo", () => {
  let clientAId: string;
  let clientAAdminCookie: string;
  let platformAdminCookie: string;
  let targetUserId: string;

  beforeAll(async () => {
    await prisma.passwordResetToken.deleteMany();
    await prisma.user.deleteMany();
    await prisma.client.deleteMany();
    await prisma.messagingConfig.deleteMany();

    await prisma.messagingConfig.create({
      data: { id: "singleton", smtpHost: "smtp.test.invalid", fromAddress: "no-reply@test.invalid", fromName: "FAD Console" },
    });

    await request(app).post("/api/auth/bootstrap/admin").send({
      name: "Superadmin de Plataforma",
      email: "superadmin.pwreset@example.com",
      password: "SuperSegura123!",
    });
    platformAdminCookie = await login("superadmin.pwreset@example.com");

    const clientRes = await request(app).post("/api/clients").set("Cookie", platformAdminCookie).send({ name: "Cliente Reset" });
    clientAId = clientRes.body.client.id;

    await prisma.user.create({
      data: {
        name: "Admin de Cliente Reset",
        email: "admin.clientereset@example.com",
        passwordHash: await hashPassword("SuperSegura123!"),
        role: "ADMIN",
        active: true,
        clientId: clientAId,
      },
    });
    clientAAdminCookie = await login("admin.clientereset@example.com");

    const targetUser = await prisma.user.create({
      data: {
        name: "Usuario Objetivo",
        email: "objetivo.pwreset@example.com",
        passwordHash: await hashPassword("ContraseñaOriginal1!"),
        role: "OPERATOR",
        active: true,
        clientId: clientAId,
      },
    });
    targetUserId = targetUser.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("POST /forgot-password responde igual exista o no el correo (sin enumeración)", async () => {
    sendMailMock.mockClear();
    const unknown = await request(app).post("/api/auth/forgot-password").send({ email: "no-existe@example.com" });
    expect(unknown.status).toBe(200);
    expect(sendMailMock).not.toHaveBeenCalled();

    const known = await request(app).post("/api/auth/forgot-password").send({ email: "objetivo.pwreset@example.com" });
    expect(known.status).toBe(200);
    expect(known.body.message).toBe(unknown.body.message);
    expect(sendMailMock).toHaveBeenCalledTimes(1);
  });

  it("el token del correo funciona una sola vez y cambia la contraseña de verdad", async () => {
    sendMailMock.mockClear();
    await request(app).post("/api/auth/forgot-password").send({ email: "objetivo.pwreset@example.com" });
    const token = extractTokenFromEmail();

    const reset = await request(app).post("/api/auth/reset-password").send({ token, password: "ContraseñaNueva1!" });
    expect(reset.status).toBe(204);

    const oldLogin = await request(app).post("/api/auth/login").send({ email: "objetivo.pwreset@example.com", password: "ContraseñaOriginal1!" });
    expect(oldLogin.status).toBe(401);
    const newLogin = await request(app).post("/api/auth/login").send({ email: "objetivo.pwreset@example.com", password: "ContraseñaNueva1!" });
    expect(newLogin.status).toBe(200);

    const reuse = await request(app).post("/api/auth/reset-password").send({ token, password: "OtraContraseña1!" });
    expect(reuse.status).toBe(400);
  });

  it("un token inválido siempre da el mismo error genérico", async () => {
    const res = await request(app).post("/api/auth/reset-password").send({ token: "token-que-nunca-existio", password: "ContraseñaNueva1!" });
    expect(res.status).toBe(400);
  });

  it("PATCH /users/:id con password: solo el superadministrador (ADMIN de plataforma) puede cambiarla directamente", async () => {
    const byClientAdmin = await request(app)
      .patch(`/api/users/${targetUserId}`)
      .set("Cookie", clientAAdminCookie)
      .send({ password: "ForzadaPorClienteAdmin1!" });
    expect(byClientAdmin.status).toBe(403);

    const bySuperAdmin = await request(app)
      .patch(`/api/users/${targetUserId}`)
      .set("Cookie", platformAdminCookie)
      .send({ password: "ForzadaPorSuperadmin1!" });
    expect(bySuperAdmin.status).toBe(200);

    const login = await request(app).post("/api/auth/login").send({ email: "objetivo.pwreset@example.com", password: "ForzadaPorSuperadmin1!" });
    expect(login.status).toBe(200);

    const auditEntry = await prisma.auditLog.findFirst({
      where: { action: "ADMIN_PASSWORD_RESET", entityId: targetUserId },
      orderBy: { createdAt: "desc" },
    });
    expect(auditEntry).not.toBeNull();
  });

  it("POST /users/:id/send-password-reset funciona para CUALQUIER admin dentro de su alcance (sin cambiar la contraseña directamente)", async () => {
    sendMailMock.mockClear();
    const res = await request(app).post(`/api/users/${targetUserId}/send-password-reset`).set("Cookie", clientAAdminCookie);
    expect(res.status).toBe(200);
    expect(sendMailMock).toHaveBeenCalledTimes(1);
  });

  it("un ADMIN no puede disparar el envío para un usuario fuera de su alcance", async () => {
    const outsider = await prisma.user.create({
      data: {
        name: "Usuario Fuera de Alcance",
        email: "fuera-de-alcance@example.com",
        passwordHash: await hashPassword("Cualquiera1!"),
        role: "OPERATOR",
        active: true,
        clientId: null,
      },
    });
    const res = await request(app).post(`/api/users/${outsider.id}/send-password-reset`).set("Cookie", clientAAdminCookie);
    expect(res.status).toBe(403);
  });
});

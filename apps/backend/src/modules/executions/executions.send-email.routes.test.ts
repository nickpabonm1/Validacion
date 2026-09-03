import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createApp } from "../../app";
import { prisma } from "../../lib/prisma";
import { toJsonField } from "../../lib/json-field";
import { credentialEncryptionService } from "../credentials/credential-encryption.service";

const sendMailMock = vi.fn().mockResolvedValue({ messageId: "mocked-message-id" });
vi.mock("nodemailer", () => ({
  default: { createTransport: () => ({ sendMail: sendMailMock }) },
}));

const app = createApp();

describe("POST /api/executions/:id/send-email — usa la plantilla propia del cliente dueño del ambiente", () => {
  let adminCookie: string;
  let clientId: string;
  let executionId: string;

  beforeAll(async () => {
    await prisma.validationExecution.deleteMany();
    await prisma.apiEnvironment.deleteMany();
    await prisma.user.deleteMany();
    await prisma.client.deleteMany();
    await prisma.messagingConfig.deleteMany();

    await prisma.messagingConfig.create({
      data: { id: "singleton", smtpHost: "smtp.test.invalid", fromAddress: "no-reply@test.invalid", fromName: "FAD Console" },
    });

    await request(app).post("/api/auth/bootstrap/admin").send({
      name: "Admin de Prueba",
      email: "admin.sendemail@example.com",
      password: "SuperSegura123!",
    });
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin.sendemail@example.com", password: "SuperSegura123!" });
    adminCookie = login.headers["set-cookie"];

    const client = await prisma.client.create({
      data: { name: "Cliente con plantilla propia", emailSubjectTemplate: "Hola {{clientName}}", emailBodyTemplate: "<p>Ir a: {{link}}</p>" },
    });
    clientId = client.id;

    const environment = await prisma.apiEnvironment.create({
      data: {
        name: "Env de prueba envío correo",
        environmentType: "UATHA",
        baseUrl: "https://fad.test.invalid",
        basicAuthUsernameEnc: credentialEncryptionService.encrypt("basic-user"),
        basicAuthPasswordEnc: credentialEncryptionService.encrypt("basic-pass"),
        apiUsernameEnc: credentialEncryptionService.encrypt("api-user"),
        apiPasswordEnc: credentialEncryptionService.encrypt("api-pass"),
        passwordIsPreHashed: true,
        clientId,
      },
    });

    const execution = await prisma.validationExecution.create({
      data: {
        validationId: "demo-validation-id-email",
        processName: "Prueba envío correo",
        environmentId: environment.id,
        requestPayload: toJsonField({ client: { name: "PRUEBA", mail: "cliente@example.com" }, steps: {} }),
        normalizedResponse: null,
        clientNameMasked: "P*****",
        clientEmailMasked: "c****@example.com",
        isDemo: false,
      },
    });
    executionId = execution.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("envía el correo usando la plantilla propia del cliente, sustituyendo los placeholders", async () => {
    const res = await request(app)
      .post(`/api/executions/${executionId}/send-email`)
      .set("Cookie", adminCookie)
      .send({ to: "destinatario@example.com", publicUrl: "https://ejemplo.invalid/v/abc123" });

    expect(res.status).toBe(200);
    expect(res.body.delivered).toBe(true);
    expect(sendMailMock).toHaveBeenCalledTimes(1);

    const sentMail = sendMailMock.mock.calls[0]![0];
    expect(sentMail.to).toBe("destinatario@example.com");
    expect(sentMail.subject).toBe("Hola Cliente con plantilla propia");
    expect(sentMail.html).toContain("https://ejemplo.invalid/v/abc123");
    expect(sentMail.text).not.toMatch(/<[^>]+>/);
  });

  it("rechaza un correo inválido con un error de validación", async () => {
    const res = await request(app)
      .post(`/api/executions/${executionId}/send-email`)
      .set("Cookie", adminCookie)
      .send({ to: "no-es-un-correo", publicUrl: "https://ejemplo.invalid/v/abc123" });
    expect(res.status).toBe(400);
  });
});

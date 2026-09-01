import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../app";
import { prisma } from "../../lib/prisma";
import { createExecution } from "../executions/executions.service";

const app = createApp();

async function waitForProcessingStatus(webhookEventId: string, timeoutMs = 5000): Promise<string> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const event = await prisma.webhookEvent.findUnique({ where: { id: webhookEventId } });
    if (event && event.processingStatus !== "RECEIVED") return event.processingStatus;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("Timeout esperando el procesamiento del webhook");
}

describe("Webhooks: recepción idempotente y resync de ejecución (integración)", () => {
  let environmentId: string;
  let validationId: string;
  let executionId: string;

  beforeAll(async () => {
    await prisma.webhookEvent.deleteMany();
    await prisma.validationStepExecution.deleteMany();
    await prisma.validationExecution.deleteMany();
    await prisma.validationTemplate.deleteMany();
    await prisma.apiEnvironment.deleteMany();

    const environment = await prisma.apiEnvironment.create({
      data: {
        name: "Env de prueba webhooks",
        environmentType: "UATHA",
        baseUrl: "https://fad.test.invalid",
        webhookActive: false,
      },
    });
    environmentId = environment.id;

    const execution = await createExecution({
      environmentId,
      templateId: null,
      requestConfig: {
        processName: "Onboarding webhook test",
        validity: 5,
        client: { name: "Cliente Prueba", mail: "cliente@example.com", phone: "+573000000000" },
        steps: { location: { order: 1, show: true, configuration: {}, features: {} } },
      },
      userId: null,
      demo: true,
    });
    executionId = execution.id;
    validationId = execution.validationId as string;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("crea la ejecución demo con un validationId simulado", () => {
    expect(validationId).toBeTruthy();
  });

  it("acepta un webhook conocido, lo vincula a la ejecución y dispara un resync", async () => {
    const envelope = {
      id: randomUUID(),
      idUser: "demo-user",
      event: "COMPLETED_VALIDATION",
      creationDate: "01/01/2026 10:06:00",
      data: {
        validationName: "Onboarding webhook test",
        startDate: "2026-01-01T10:00:00",
        endDate: "2026-01-01T10:06:00",
        validationId,
        result: { success: true, error: null, code: 0, data: { status: "TERMINADO" } },
      },
      retry: 0,
      error: "",
      idOriginal: null,
    };

    const res = await request(app).post("/api/webhooks/fad").send(envelope);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("RECEIVED");

    const finalStatus = await waitForProcessingStatus(res.body.webhookEventId ?? (await prisma.webhookEvent.findFirstOrThrow({ where: { externalEventId: envelope.id } })).id);
    expect(finalStatus).toBe("PROCESSED");

    const execution = await prisma.validationExecution.findUniqueOrThrow({ where: { id: executionId } });
    expect(execution.normalizedStatus).toBe("COMPLETED");
    expect(execution.rawStatus).toBe("TERMINADO");
  });

  it("es idempotente ante el mismo evento entregado dos veces", async () => {
    const envelope = {
      id: randomUUID(),
      idUser: "demo-user",
      event: "VALIDATION_CHANGE_STATUS",
      creationDate: "01/01/2026 10:07:00",
      data: { validationId, result: "Aprobado", status: "Terminado" },
      retry: 0,
      error: "",
      idOriginal: null,
    };

    const first = await request(app).post("/api/webhooks/fad").send(envelope);
    expect(first.status).toBe(200);
    expect(first.body.status).not.toBe("DUPLICATE");

    const second = await request(app).post("/api/webhooks/fad").send(envelope);
    expect(second.status).toBe(200);
    expect(second.body.status).toBe("DUPLICATE");

    const count = await prisma.webhookEvent.count({ where: { externalEventId: envelope.id } });
    expect(count).toBe(1);
  });

  it("acepta y almacena un evento desconocido sin rechazarlo", async () => {
    const envelope = {
      id: randomUUID(),
      idUser: "demo-user",
      event: "SOME_FUTURE_EVENT",
      creationDate: "01/01/2026 10:08:00",
      data: { anything: "goes" },
      retry: 0,
      error: "",
      idOriginal: null,
    };

    const res = await request(app).post("/api/webhooks/fad").send(envelope);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("UNKNOWN_EVENT");

    const stored = await prisma.webhookEvent.findFirst({ where: { externalEventId: envelope.id } });
    expect(stored).toBeTruthy();
    expect(stored?.processingStatus).toBe("UNKNOWN_EVENT");
  });
});

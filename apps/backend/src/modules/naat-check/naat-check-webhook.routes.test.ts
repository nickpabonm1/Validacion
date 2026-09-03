import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../app";
import { prisma } from "../../lib/prisma";

const app = createApp();

describe("POST /api/webhooks/naat-check", () => {
  beforeAll(async () => {
    await prisma.webhookEvent.deleteMany({ where: { eventType: "naat_check.validation_message" } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  const envelope = {
    id: "050a6e0a-b797-4a6c-8526-02ffdea5ed66",
    idUser: "929cd657-8ed5-4aa1-9957-c4246ba6587e",
    event: "VALIDATION_MESSAGE",
    creationDate: "04/07/2022 01:13:52",
    data: { idMessage: "6b7d4187-263c-4d31-ae03-f985cb0e6649", response: { risk: "MEDIUM", key: "TEMP_DATA_RISK" }, type: "MULTIPLE", modificationDate: "16/01/2024 18:44:06" },
    retry: 0,
    error: "",
    idOriginal: null,
  };

  it("sin credenciales de webhook NAAT-CHECK configuradas para ningún ambiente, acepta y registra (no bloquea la puesta en marcha)", async () => {
    const res = await request(app).post("/api/webhooks/naat-check").send(envelope);
    expect(res.status).toBe(200);

    const stored = await prisma.webhookEvent.findFirst({ where: { externalEventId: envelope.id } });
    expect(stored).not.toBeNull();
    expect(stored?.eventType).toBe("naat_check.validation_message");
  });

  it("una segunda entrega idéntica (mismo id/evento/retry) no duplica la fila (idempotente)", async () => {
    await request(app).post("/api/webhooks/naat-check").send(envelope);
    const count = await prisma.webhookEvent.count({ where: { externalEventId: envelope.id } });
    expect(count).toBe(1);
  });

  it("un cuerpo con forma inesperada igual responde 200 (no genera reintentos infinitos del emisor)", async () => {
    const res = await request(app).post("/api/webhooks/naat-check").send({ garbage: true });
    expect(res.status).toBe(200);
  });
});

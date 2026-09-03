import { createHash } from "node:crypto";
import { WebhookEnvelopeSchema, type WebhookEnvelope } from "@fad-console/validation-schemas";
import { prisma } from "../../lib/prisma";
import { toJsonField } from "../../lib/json-field";
import { logger } from "../../lib/logger";
import { normalizeWebhookEvent } from "../../normalize/webhook";
import { syncExecutionStatus } from "../executions/executions.service";
import { assertWithinScope, type ClientScope } from "../clients/client-scope";

function computeUniqueHash(envelope: WebhookEnvelope): string {
  const parts = [envelope.id, envelope.idOriginal ?? "", envelope.event].join("::");
  return createHash("sha256").update(parts).digest("hex");
}

export interface IngestResult {
  status: "PROCESSED" | "DUPLICATE" | "UNKNOWN_EVENT" | "RECEIVED";
  webhookEventId: string;
}

/**
 * Ingiere un webhook: valida el envelope, garantiza idempotencia (hash de id+idOriginal+event)
 * y persiste el payload original SIEMPRE, incluso para eventos desconocidos (sección 19 del
 * brief). El procesamiento que dispara una resincronización de la ejecución asociada ocurre de
 * forma desacoplada (no bloquea la respuesta 2xx al emisor).
 */
export async function ingestWebhook(rawBody: unknown): Promise<IngestResult> {
  const envelope = WebhookEnvelopeSchema.parse(rawBody);
  const uniqueHash = computeUniqueHash(envelope);

  const existing = await prisma.webhookEvent.findUnique({ where: { uniqueHash } });
  if (existing) {
    return { status: "DUPLICATE", webhookEventId: existing.id };
  }

  const normalized = normalizeWebhookEvent(envelope);

  const validationExecution = normalized.validationId
    ? await prisma.validationExecution.findFirst({ where: { validationId: normalized.validationId } })
    : null;

  const created = await prisma.webhookEvent.create({
    data: {
      externalEventId: envelope.id,
      idOriginal: envelope.idOriginal ?? null,
      idUser: envelope.idUser ?? null,
      eventType: envelope.event,
      validationId: normalized.validationId,
      validationExecutionId: validationExecution?.id ?? null,
      creationDateRaw: envelope.creationDate ?? null,
      retry: envelope.retry ?? 0,
      error: envelope.error ?? null,
      payload: toJsonField(envelope),
      processingStatus: normalized.known ? "RECEIVED" : "UNKNOWN_EVENT",
      uniqueHash,
    },
  });

  if (normalized.known && normalized.biometric && validationExecution) {
    void processBiometricEventAsync(created.id, validationExecution.id);
  } else {
    await prisma.webhookEvent.update({
      where: { id: created.id },
      data: { processingStatus: normalized.known ? "PROCESSED" : "UNKNOWN_EVENT", processedAt: new Date() },
    });
  }

  return {
    status: normalized.known ? (validationExecution ? "RECEIVED" : "PROCESSED") : "UNKNOWN_EVENT",
    webhookEventId: created.id,
  };
}

async function processBiometricEventAsync(webhookEventId: string, executionId: string): Promise<void> {
  try {
    await syncExecutionStatus(executionId);
    await prisma.webhookEvent.update({
      where: { id: webhookEventId },
      data: { processingStatus: "PROCESSED", processedAt: new Date() },
    });
  } catch (error) {
    logger.error("Error procesando webhook biométrico (resync de ejecución)", {
      webhookEventId,
      executionId,
      error: (error as Error).message,
    });
    await prisma.webhookEvent.update({
      where: { id: webhookEventId },
      data: { processingStatus: "ERROR", processingError: (error as Error).message, processedAt: new Date() },
    });
  }
}

export interface WebhookFilters {
  eventType?: string;
  processingStatus?: string;
  validationId?: string;
}

export async function listWebhookEvents(filters: WebhookFilters, scope?: ClientScope) {
  const where: Record<string, unknown> = {};
  if (filters.eventType) where.eventType = filters.eventType;
  if (filters.processingStatus) where.processingStatus = filters.processingStatus;
  if (filters.validationId) where.validationId = filters.validationId;
  // Un webhook aún no asociado a ninguna ejecución no tiene forma de atribuirse a un cliente, así
  // que se excluye del listado de un cliente (nunca se muestra un dato que no se pueda confirmar
  // que le pertenece) — ver la misma decisión en settings.service.ts (getDashboardStats).
  if (scope?.allowedIds) where.validationExecution = { environment: { clientId: { in: scope.allowedIds } } };
  return prisma.webhookEvent.findMany({ where, orderBy: { receivedAt: "desc" }, take: 200 });
}

export async function getWebhookEvent(id: string, scope?: ClientScope) {
  const event = await prisma.webhookEvent.findUnique({
    where: { id },
    include: { validationExecution: { include: { environment: true } } },
  });
  if (event && scope) assertWithinScope(event.validationExecution?.environment.clientId ?? null, scope);
  return event;
}

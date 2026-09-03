import { Router } from "express";
import { createHash } from "node:crypto";
import rateLimit from "express-rate-limit";
import { NaatCheckWebhookEnvelopeSchema } from "@fad-console/validation-schemas";
import { prisma } from "../../lib/prisma";
import { toJsonField } from "../../lib/json-field";
import { logger } from "../../lib/logger";
import { isNaatCheckWebhookAuthorized } from "./naat-check-webhook-auth";

export const naatCheckWebhookPublicRouter = Router();

const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

function computeUniqueHash(envelope: { id: string; idOriginal?: string | null; event: string; retry?: number }): string {
  const parts = [envelope.id, envelope.idOriginal ?? "", envelope.event, String(envelope.retry ?? 0)].join("::");
  return createHash("sha256").update(parts).digest("hex");
}

/**
 * Receptor del webhook de NAAT-CHECK (PDF sección 2.3, evento `VALIDATION_MESSAGE`). Esta consola
 * dispara sus recheck siempre en modo síncrono (ver `naat-check-client.ts`), así que este endpoint
 * NO es el camino principal — existe por si NAAT-CHECK igual entrega una notificación (p. ej.
 * reintentos tardíos de una solicitud). Se registra el envelope crudo en `WebhookEvent`
 * (`eventType: "naat_check.validation_message"`, reutilizando la misma tabla que los webhooks de
 * FAD para que quede visible en Webhooks > Auditoría) SIN intentar correlacionarlo con una
 * ejecución específica — el `ack` síncrono que documenta el PDF no incluye un identificador que
 * permita esa correlación con certeza, y fabricar una sería inventar un dato que NAAT-CHECK nunca
 * confirmó.
 */
naatCheckWebhookPublicRouter.post("/naat-check", webhookLimiter, async (req, res) => {
  const auth = await isNaatCheckWebhookAuthorized(req.get("authorization") ?? undefined);
  if (!auth.authorized) {
    logger.warn("Webhook NAAT-CHECK rechazado: autenticación inválida", { reason: auth.reason });
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Autenticación inválida" } });
    return;
  }

  try {
    const parsed = NaatCheckWebhookEnvelopeSchema.safeParse(req.body);
    if (!parsed.success) {
      logger.warn("Webhook NAAT-CHECK con envelope inesperado", { body: JSON.stringify(req.body).slice(0, 2000) });
      res.status(200).json({ received: true });
      return;
    }
    const envelope = parsed.data;
    await prisma.webhookEvent.upsert({
      where: { uniqueHash: computeUniqueHash(envelope) },
      update: {},
      create: {
        externalEventId: envelope.id,
        idOriginal: envelope.idOriginal ?? null,
        idUser: envelope.idUser ?? null,
        eventType: "naat_check.validation_message",
        creationDateRaw: envelope.creationDate ?? null,
        retry: envelope.retry ?? 0,
        error: envelope.error ?? null,
        payload: toJsonField(envelope),
        processingStatus: "RECEIVED",
        uniqueHash: computeUniqueHash(envelope),
      },
    });
    res.status(200).json({ received: true });
  } catch (error) {
    logger.error("Error registrando webhook de NAAT-CHECK", { error: error instanceof Error ? error.message : error });
    // Se responde 200 igualmente para no generar reintentos infinitos por un payload que la
    // aplicación no pudo interpretar (mismo criterio que el webhook de FAD).
    res.status(200).json({ received: true });
  }
});

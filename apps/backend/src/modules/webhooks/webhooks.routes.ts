import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { fromJsonField } from "../../lib/json-field";
import { logger } from "../../lib/logger";
import { requireAuth, requireRole } from "../auth/auth.middleware";
import { isWebhookRequestAuthorized } from "./webhook-auth";
import { getWebhookEvent, ingestWebhook, listWebhookEvents } from "./webhooks.service";

export const webhooksRouter = Router();
export const webhooksPublicRouter = Router();

const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

/** Endpoint público que consume FAD. No usa cookies de sesión; se autentica con Basic Auth
 * propio (ver webhook-auth.ts) validado en tiempo constante. Responde 2xx rápido y procesa de
 * forma desacoplada (ver webhooks.service.ts). */
webhooksPublicRouter.post("/fad", webhookLimiter, async (req, res) => {
  const auth = await isWebhookRequestAuthorized(req.get("authorization") ?? undefined);
  if (!auth.authorized) {
    logger.warn("Webhook rechazado: autenticación inválida", { reason: auth.reason });
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Autenticación inválida" } });
    return;
  }

  try {
    const result = await ingestWebhook(req.body);
    res.status(200).json({ received: true, status: result.status });
  } catch (error) {
    logger.error("Error ingiriendo webhook", { error: (error as Error).message });
    // Se responde 200 igualmente para no generar reintentos infinitos por un payload que la
    // aplicación no pudo interpretar; el error queda registrado para análisis.
    res.status(200).json({ received: true, status: "ERROR" });
  }
});

webhooksRouter.use(requireAuth);

webhooksRouter.get("/", requireRole("ADMIN", "OPERATOR", "AUDITOR"), async (req, res, next) => {
  try {
    const query = z
      .object({ eventType: z.string().optional(), processingStatus: z.string().optional(), validationId: z.string().optional() })
      .parse(req.query);
    const events = await listWebhookEvents(query);
    res.json({
      events: events.map((e) => ({
        id: e.id,
        externalEventId: e.externalEventId,
        eventType: e.eventType,
        validationId: e.validationId,
        receivedAt: e.receivedAt.toISOString(),
        retry: e.retry,
        processingStatus: e.processingStatus,
        processedAt: e.processedAt ? e.processedAt.toISOString() : null,
        processingError: e.processingError,
      })),
    });
  } catch (error) {
    next(error);
  }
});

webhooksRouter.get("/:id", requireRole("ADMIN", "OPERATOR", "AUDITOR"), async (req, res, next) => {
  try {
    const event = await getWebhookEvent(req.params.id as string);
    if (!event) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Evento no encontrado" } });
      return;
    }
    res.json({
      event: {
        id: event.id,
        externalEventId: event.externalEventId,
        eventType: event.eventType,
        validationId: event.validationId,
        receivedAt: event.receivedAt.toISOString(),
        retry: event.retry,
        processingStatus: event.processingStatus,
        processedAt: event.processedAt ? event.processedAt.toISOString() : null,
        processingError: event.processingError,
        payload: fromJsonField(event.payload, null),
      },
    });
  } catch (error) {
    next(error);
  }
});

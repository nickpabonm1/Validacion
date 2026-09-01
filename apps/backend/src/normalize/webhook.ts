import { isBiometricWebhookEvent, isKnownWebhookEvent } from "@fad-console/shared-types";
import type { WebhookEnvelope } from "@fad-console/validation-schemas";
import { parseFlexibleDate } from "./dates";

export interface NormalizedWebhookEvent {
  event: string;
  known: boolean;
  biometric: boolean;
  validationId: string | null;
  creationDateIso: string | null;
}

function extractValidationId(data: unknown): string | null {
  if (data && typeof data === "object" && "validationId" in data) {
    const value = (data as Record<string, unknown>).validationId;
    if (typeof value === "string") return value;
  }
  return null;
}

/** Normaliza el envelope de un webhook sin rechazar eventos desconocidos (sección 24/19 del brief). */
export function normalizeWebhookEvent(envelope: WebhookEnvelope): NormalizedWebhookEvent {
  return {
    event: envelope.event,
    known: isKnownWebhookEvent(envelope.event),
    biometric: isBiometricWebhookEvent(envelope.event),
    validationId: extractValidationId(envelope.data),
    creationDateIso: envelope.creationDate ? parseFlexibleDate(envelope.creationDate).iso : null,
  };
}

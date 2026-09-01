/**
 * Catálogo de eventos de webhook (Webhooks Service Definition v1.3). Un evento recibido que
 * NO esté en esta lista igual se acepta y se persiste (`eventType` tal cual, `known: false`);
 * nunca se rechaza el webhook por esto.
 */
export const BIOMETRIC_WEBHOOK_EVENTS = [
  "CREATED_VALIDATION_STEP",
  "RESULT_VALIDATION_STEP",
  "COMPLETED_VALIDATION_STEP",
  "COMPLETED_VALIDATION",
  "VALIDATION_CHANGE_STATUS",
] as const;
export type BiometricWebhookEvent = (typeof BIOMETRIC_WEBHOOK_EVENTS)[number];

export const FAD_FEA_WEBHOOK_EVENTS = [
  "CREATE_OTP",
  "CREATE_REQUISITION",
  "SIGNED_REQUISITION",
  "REJECTED_REQUISITION",
  "REJECTED_USER_REQUISITION",
  "CANCEL_REQUISITION",
  "EXPIRED_REQUISITION",
  "REQUISITION_PART_SIGNED",
  "CREATE_FEA_REQUISITION",
  "CREATE_FAD_REQUISITION_BY_FEA",
  "REJECTED_FEA_DOCUMENT",
  "EXPIRED_FEA_REQUISITION",
  "SIGNED_FEA_DOCUMENT_BY_FAD",
  "SIGNED_FEA_DOCUMENT",
  "REJECTED_FEA_DOCUMENT_BY_FAD",
  "PART_SIGNED_FEA_DOCUMENT",
  "FULLY_SIGNED_FEA_REQUISITION",
] as const;
export type FadFeaWebhookEvent = (typeof FAD_FEA_WEBHOOK_EVENTS)[number];

export const KNOWN_WEBHOOK_EVENTS = [
  ...BIOMETRIC_WEBHOOK_EVENTS,
  ...FAD_FEA_WEBHOOK_EVENTS,
] as const;
export type KnownWebhookEvent = (typeof KNOWN_WEBHOOK_EVENTS)[number];

export function isKnownWebhookEvent(event: string): event is KnownWebhookEvent {
  return (KNOWN_WEBHOOK_EVENTS as readonly string[]).includes(event);
}

export function isBiometricWebhookEvent(event: string): event is BiometricWebhookEvent {
  return (BIOMETRIC_WEBHOOK_EVENTS as readonly string[]).includes(event);
}

/** Renderers extensibles para resultados de validaciones externas (sección 18 del brief). */
export const EXTERNAL_VALIDATION_RESULT_KEYS = [
  "accuant_validation",
  "comparison_selfie_ine_validation",
  "validation_big_data_corp_decision_check",
  "validation_big_data_corp_empresa",
  "validation_big_data_corp_pessoa",
  "validation_big_data_corp_pessoa_kyc",
  "validation_serpro",
  "validation_unico",
] as const;
export type ExternalValidationResultKey = (typeof EXTERNAL_VALIDATION_RESULT_KEYS)[number];

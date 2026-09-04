import type { RiskLevel, WebSdkTemplateCustomizationDto, WebSdkTemplateDto } from "@fad-console/shared-types";
import type { WebSdkOnboardingMessages, WebSdkTemplateInput } from "@fad-console/validation-schemas";
import { WebSdkOnboardingMessagesSchema } from "@fad-console/validation-schemas";
import { prisma } from "../../lib/prisma";
import { fromJsonField, toJsonField } from "../../lib/json-field";
import { AppError } from "../../lib/errors";
import { assertWithinScope, type ClientScope } from "../clients/client-scope";
import { getEnvironmentOrThrow } from "../environments/environments.service";

type WebSdkTemplateRecord = Awaited<ReturnType<typeof prisma.webSdkTemplate.findFirstOrThrow>>;
type WebSdkConfigRecord = Awaited<ReturnType<typeof prisma.webSdkConfig.findFirstOrThrow>>;

const DEFAULT_ONBOARDING_MESSAGES = WebSdkOnboardingMessagesSchema.parse({});

export function toWebSdkTemplateDto(template: WebSdkTemplateRecord): WebSdkTemplateDto {
  return {
    id: template.id,
    name: template.name,
    description: template.description,
    environmentId: template.environmentId,
    active: template.active,
    onboardingMessages: fromJsonField(template.onboardingMessages, {}),
    customization: fromJsonField(template.customization, {}),
    checkMaxAttempts: template.checkMaxAttempts,
    checkAcceptedRisk: template.checkAcceptedRisk as RiskLevel | null,
    faceMatchMinConfidence: template.faceMatchMinConfidence,
    createdById: template.createdById,
    updatedById: template.updatedById,
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
  };
}

export async function listWebSdkTemplates(environmentId: string, scope?: ClientScope) {
  await getEnvironmentOrThrow(environmentId, scope);
  return prisma.webSdkTemplate.findMany({ where: { environmentId }, orderBy: { createdAt: "desc" } });
}

export async function getWebSdkTemplateOrThrow(id: string, scope?: ClientScope) {
  const template = await prisma.webSdkTemplate.findUnique({ where: { id }, include: { environment: true } });
  if (!template) throw AppError.notFound("Plantilla Web SDK no encontrada");
  if (scope) assertWithinScope(template.environment.clientId, scope);
  return template;
}

export async function createWebSdkTemplate(input: WebSdkTemplateInput, userId: string | null, scope?: ClientScope) {
  const environment = await getEnvironmentOrThrow(input.environmentId, scope);
  if (environment.integrationModel !== "WEB_SDK") {
    throw AppError.badRequest("Solo los ambientes con modelo de integración Web SDK admiten plantillas Web SDK.");
  }
  return prisma.webSdkTemplate.create({
    data: {
      name: input.name,
      description: input.description ?? null,
      environmentId: input.environmentId,
      active: input.active,
      onboardingMessages: toJsonField(input.onboardingMessages),
      customization: toJsonField(input.customization),
      checkMaxAttempts: input.checkMaxAttempts ?? null,
      checkAcceptedRisk: input.checkAcceptedRisk ?? null,
      faceMatchMinConfidence: input.faceMatchMinConfidence ?? null,
      createdById: userId,
      updatedById: userId,
    },
  });
}

export async function updateWebSdkTemplate(id: string, input: WebSdkTemplateInput, userId: string | null, scope?: ClientScope) {
  await getWebSdkTemplateOrThrow(id, scope);
  await getEnvironmentOrThrow(input.environmentId, scope);
  return prisma.webSdkTemplate.update({
    where: { id },
    data: {
      name: input.name,
      description: input.description ?? null,
      environmentId: input.environmentId,
      active: input.active,
      onboardingMessages: toJsonField(input.onboardingMessages),
      customization: toJsonField(input.customization),
      checkMaxAttempts: input.checkMaxAttempts ?? null,
      checkAcceptedRisk: input.checkAcceptedRisk ?? null,
      faceMatchMinConfidence: input.faceMatchMinConfidence ?? null,
      updatedById: userId,
    },
  });
}

export async function deleteWebSdkTemplate(id: string, scope?: ClientScope) {
  await getWebSdkTemplateOrThrow(id, scope);
  await prisma.webSdkTemplate.delete({ where: { id } });
}

export interface WebSdkEffectiveSettings {
  onboardingMessages: WebSdkOnboardingMessages;
  /** `null` cuando la plantilla no fija tema propio — el ambiente sigue mandando su propio
   * `configuration.customization.fadCustomization` sin que este helper lo toque. */
  customizationOverride: WebSdkTemplateCustomizationDto | null;
  checkMaxAttempts: number;
  checkAcceptedRisk: RiskLevel;
  faceMatchMinConfidence: number;
}

/**
 * Combina la configuración del ambiente (siempre presente) con la de la plantilla Web SDK
 * elegida (opcional) — DEFAULT < ambiente < plantilla para los textos, y "si la plantilla no fija
 * el campo, se usa el del ambiente" para tema/umbrales. Nunca fabrica un valor: cuando no hay
 * plantilla, el resultado es exactamente lo que ya tenía el ambiente (comportamiento sin cambios
 * para las ejecuciones que no usan plantilla).
 */
export function resolveEffectiveSettings(
  config: WebSdkConfigRecord,
  template: WebSdkTemplateRecord | null,
): WebSdkEffectiveSettings {
  const envMessages = fromJsonField<Partial<WebSdkOnboardingMessages>>(config.onboardingMessages, {});
  const templateMessages = template ? fromJsonField<Partial<WebSdkOnboardingMessages>>(template.onboardingMessages, {}) : {};
  const onboardingMessages: WebSdkOnboardingMessages = { ...DEFAULT_ONBOARDING_MESSAGES, ...envMessages, ...templateMessages };

  const templateCustomization = template ? fromJsonField<WebSdkTemplateCustomizationDto>(template.customization, {}) : {};
  const customizationOverride = Object.keys(templateCustomization).length > 0 ? templateCustomization : null;

  return {
    onboardingMessages,
    customizationOverride,
    checkMaxAttempts: template?.checkMaxAttempts ?? config.checkMaxAttempts,
    checkAcceptedRisk: (template?.checkAcceptedRisk ?? config.checkAcceptedRisk) as RiskLevel,
    faceMatchMinConfidence: template?.faceMatchMinConfidence ?? config.faceMatchMinConfidence,
  };
}

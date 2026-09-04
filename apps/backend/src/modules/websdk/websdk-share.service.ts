import { randomBytes } from "node:crypto";
import type { WebSdkShareLinkDto, WebSdkPublicShareInfoDto, ExternalWebSdkValidationStatusDto } from "@fad-console/shared-types";
import type { WebSdkShareLinkInput } from "@fad-console/validation-schemas";
import { prisma } from "../../lib/prisma";
import { fromJsonField, toJsonField } from "../../lib/json-field";
import { AppError } from "../../lib/errors";
import { env } from "../../config/env";
import { maskName } from "../../normalize/mask";
import { getEnvironmentOrThrow } from "../environments/environments.service";
import { getWebSdkConfig } from "./websdk-config.service";
import { resolveEffectiveSettings } from "./websdk-template.service";
import { DEFAULT_ONBOARDING_MESSAGES } from "@fad-console/validation-schemas";

/** Un enlace compartido vive 30 minutos desde su creación — suficiente para que el cliente lo
 * abra desde el QR/correo/WhatsApp y complete la captura, corto para minimizar la ventana de un
 * enlace filtrado. */
const SHARE_LINK_TTL_MINUTES = 30;

type ShareLinkRecord = Awaited<ReturnType<typeof prisma.webSdkShareLink.findUniqueOrThrow>>;

interface ShareLinkClient {
  name: string;
  mail: string;
  phone: string;
}

function buildPublicUrl(token: string): string {
  return `${env.publicAppUrl.replace(/\/$/, "")}/v/${token}`;
}

export function toShareLinkDto(link: ShareLinkRecord, environmentName: string, includeToken: boolean): WebSdkShareLinkDto {
  const client = fromJsonField<ShareLinkClient>(link.client, { name: "", mail: "", phone: "" });
  return {
    id: link.id,
    token: includeToken ? link.token : null,
    publicUrl: includeToken ? buildPublicUrl(link.token) : null,
    environmentId: link.environmentId,
    environmentName,
    processName: link.processName,
    clientNameMasked: maskName(client.name),
    status: link.status as WebSdkShareLinkDto["status"],
    executionId: link.executionId,
    expiresAt: link.expiresAt.toISOString(),
    usedAt: link.usedAt ? link.usedAt.toISOString() : null,
    createdAt: link.createdAt.toISOString(),
  };
}

/** Crea un enlace de captura Web SDK compartible. No arranca la ejecución todavía — eso ocurre
 * recién cuando el cliente final abre `/v/:token` (ver `startShareLinkExecution`), para que el
 * `sdkToken`/sesión del SDK esté fresca en el dispositivo que realmente hace la captura.
 * `createdById` es `null` cuando lo crea un sistema externo con la clave de API del ambiente
 * (ver `websdk-external.routes.ts`), no un operador con sesión en esta consola. */
export async function createShareLink(input: WebSdkShareLinkInput, createdById: string | null) {
  const environment = await getEnvironmentOrThrow(input.environmentId);
  if (environment.integrationModel !== "WEB_SDK") {
    throw AppError.badRequest("Solo los ambientes con modelo de integración Web SDK admiten enlaces compartidos.");
  }
  const config = await getWebSdkConfig(environment.id);
  if (!config) {
    throw AppError.badRequest("Este ambiente no tiene configuración Web SDK. Complétala antes de enviar un proceso.");
  }

  let webSdkTemplateId: string | null = null;
  if (input.webSdkTemplateId) {
    const template = await prisma.webSdkTemplate.findUnique({ where: { id: input.webSdkTemplateId } });
    if (!template || template.environmentId !== environment.id) {
      throw AppError.badRequest("La plantilla Web SDK indicada no existe o no pertenece a este ambiente.");
    }
    webSdkTemplateId = template.id;
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SHARE_LINK_TTL_MINUTES * 60 * 1000);

  const link = await prisma.webSdkShareLink.create({
    data: {
      token,
      environmentId: environment.id,
      templateId: input.templateId ?? null,
      webSdkTemplateId,
      processName: input.processName ?? null,
      client: toJsonField(input.client),
      status: "PENDING",
      createdById,
      expiresAt,
    },
  });

  return { link, environmentName: environment.name };
}

async function getLinkByTokenOrThrow(token: string): Promise<ShareLinkRecord> {
  const link = await prisma.webSdkShareLink.findUnique({ where: { token }, include: { environment: true } });
  if (!link) throw AppError.notFound("Enlace no encontrado o inválido.");
  if (link.status === "EXPIRED" || link.expiresAt.getTime() < Date.now()) {
    if (link.status !== "EXPIRED") await prisma.webSdkShareLink.update({ where: { token }, data: { status: "EXPIRED" } });
    throw AppError.badRequest("Este enlace expiró. Pide que te envíen uno nuevo.");
  }
  if (link.status === "COMPLETED") {
    throw AppError.badRequest("Este enlace ya se usó para completar una verificación.");
  }
  return link as ShareLinkRecord;
}

/** Info pública mínima que ve el cliente antes de arrancar la captura (sin auth). */
export async function getPublicShareInfo(token: string): Promise<WebSdkPublicShareInfoDto> {
  const link = (await getLinkByTokenOrThrow(token)) as ShareLinkRecord & {
    environment: { id: string; name: string };
  };
  const client = fromJsonField<ShareLinkClient>(link.client, { name: "", mail: "", phone: "" });
  const config = await getWebSdkConfig(link.environmentId);
  const template = link.webSdkTemplateId
    ? await prisma.webSdkTemplate.findUnique({ where: { id: link.webSdkTemplateId } })
    : null;
  const onboardingMessages = config
    ? resolveEffectiveSettings(config, template).onboardingMessages
    : DEFAULT_ONBOARDING_MESSAGES;

  return {
    status: link.status as WebSdkPublicShareInfoDto["status"],
    environmentName: link.environment.name,
    processName: link.processName,
    clientName: client.name,
    onboardingMessages,
  };
}

/** Resuelve el token a los datos necesarios para arrancar la ejecución (paso 1 del flujo
 * público). Se puede llamar más de una vez mientras el enlace siga PENDING/STARTED (idempotente:
 * si ya existe una ejecución para este enlace, se reutiliza su `environmentId`/`client`). */
export async function resolveStartInput(token: string): Promise<{
  linkId: string;
  environmentId: string;
  templateId: string | null;
  webSdkTemplateId: string | null;
  processName: string | null;
  client: ShareLinkClient;
  /** Si ya existe (el enlace pasó por /start antes, ej. el cliente recargó la página), se debe
   * reutilizar esta ejecución en vez de crear una nueva. */
  existingExecutionId: string | null;
}> {
  const link = await getLinkByTokenOrThrow(token);
  const client = fromJsonField<ShareLinkClient>(link.client, { name: "", mail: "", phone: "" });
  return {
    linkId: link.id,
    environmentId: link.environmentId,
    templateId: link.templateId,
    webSdkTemplateId: link.webSdkTemplateId,
    processName: link.processName,
    client,
    existingExecutionId: link.executionId,
  };
}

export async function markShareLinkStarted(token: string, executionId: string): Promise<void> {
  await prisma.webSdkShareLink.update({
    where: { token },
    data: { status: "STARTED", executionId, usedAt: new Date() },
  });
}

/** Resuelve el token al `executionId` en curso para los pasos siguientes (acuant-result,
 * facetec-result, complete) — nunca se acepta un `executionId` del cuerpo de la petición pública,
 * siempre se re-deriva del token para que un enlace solo pueda operar sobre SU propia ejecución. */
export async function resolveExecutionId(token: string): Promise<string> {
  const link = await getLinkByTokenOrThrow(token);
  if (!link.executionId) {
    throw AppError.badRequest("Este enlace todavía no inició una captura (llama primero a /start).");
  }
  return link.executionId;
}

export async function markShareLinkCompleted(token: string): Promise<void> {
  await prisma.webSdkShareLink.update({ where: { token }, data: { status: "COMPLETED" } });
}

/** Estado de una validación creada por un sistema externo, para que ese sistema haga polling
 * mientras su usuario completa (o no) la captura — ver `websdk-external.routes.ts`. Confirma que
 * el enlace pertenece al `environmentId` de la clave de API usada (nunca expone el estado de un
 * enlace de otro ambiente, aunque se conozca su id). */
export async function getExternalValidationStatus(
  shareLinkId: string,
  environmentId: string,
): Promise<ExternalWebSdkValidationStatusDto> {
  const link = await prisma.webSdkShareLink.findUnique({ where: { id: shareLinkId } });
  if (!link || link.environmentId !== environmentId) {
    throw AppError.notFound("Validación no encontrada.");
  }

  let normalizedStatus: string | null = null;
  let result: string | null = null;
  let detail: ExternalWebSdkValidationStatusDto["detail"] = null;
  if (link.executionId) {
    const execution = await prisma.validationExecution.findUnique({
      where: { id: link.executionId },
      select: { normalizedStatus: true, result: true, normalizedResponse: true },
    });
    normalizedStatus = execution?.normalizedStatus ?? null;
    result = execution?.result ?? null;
    // `normalizedResponse` solo queda poblado una vez que `completeWebSdkExecution` terminó (ver
    // websdk-flow.service.ts) — coincide exactamente con `link.status === "COMPLETED"`, nunca se
    // fabrica un resultado parcial mientras el usuario sigue capturando.
    detail = fromJsonField(execution?.normalizedResponse, null);
  }

  return {
    id: link.id,
    status: link.status as ExternalWebSdkValidationStatusDto["status"],
    executionId: link.executionId,
    detail,
    normalizedStatus,
    result,
    expiresAt: link.expiresAt.toISOString(),
    createdAt: link.createdAt.toISOString(),
  };
}

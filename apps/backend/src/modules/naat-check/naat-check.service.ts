import type { NaatCheckRecheckResultDto, NormalizedValidationDetail } from "@fad-console/shared-types";
import { prisma } from "../../lib/prisma";
import { fromJsonField, toJsonField } from "../../lib/json-field";
import { AppError } from "../../lib/errors";
import { logger } from "../../lib/logger";
import { logAudit, type AuditContext } from "../audit/audit.service";
import type { ClientScope } from "../clients/client-scope";
import { getExecutionOrThrow, recomputeExecutionDetail } from "../executions/executions.service";
import { fadApiAdapter } from "../fad-adapter/fad-api-adapter";
import { decryptNaatCheckCredentials, getNaatCheckConfig } from "./naat-check-config.service";
import { requestNaatCheckRecheck, type NaatCheckFile } from "./naat-check-client";

type ExecutionWithEnvironment = Awaited<ReturnType<typeof getExecutionOrThrow>>;

/** Descarga (autenticado, igual que `media-proxy.routes.ts`) las imágenes remotas del documento
 * capturado en un flujo API_BY_STEPS real — confirmado con una respuesta real: en ese modelo
 * `mediaAssets` siempre queda vacío porque las imágenes llegan como URL remota en
 * `files[].fileUrl` (`getValidationData`), nunca embebidas en base64. Nunca acepta una URL fuera
 * del host del ambiente (misma protección SSRF que el proxy de medios); una ejecución demo (URLs
 * ficticias) o cualquier archivo que falle la descarga simplemente se omite, sin fabricar datos. */
async function downloadRemoteDocumentFiles(
  detail: NormalizedValidationDetail,
  execution: ExecutionWithEnvironment,
): Promise<NaatCheckFile[]> {
  if (execution.isDemo || detail.files.length === 0) return [];

  let environmentHost: string;
  try {
    environmentHost = new URL(execution.environment.baseUrl).host;
  } catch {
    return [];
  }

  let accessToken: string;
  try {
    accessToken = await fadApiAdapter.getAccessToken(execution.environment);
  } catch (error) {
    logger.warn("No fue posible obtener un access_token para descargar imágenes para NAAT-CHECK", {
      executionId: execution.id,
      error: error instanceof Error ? error.message : error,
    });
    return [];
  }

  const files: NaatCheckFile[] = [];
  for (const file of detail.files) {
    let target: URL;
    try {
      target = new URL(file.fileUrl);
    } catch {
      continue;
    }
    if (target.host !== environmentHost) continue;

    try {
      const response = await fetch(target.toString(), { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!response.ok) continue;
      const contentType = response.headers.get("content-type") ?? "image/jpeg";
      const buffer = Buffer.from(await response.arrayBuffer());
      files.push({ file: buffer.toString("base64"), type: contentType, name: file.fileName });
    } catch (error) {
      logger.warn("No fue posible descargar un archivo para enviarlo a NAAT-CHECK", {
        executionId: execution.id,
        fileName: file.fileName,
        error: error instanceof Error ? error.message : error,
      });
    }
  }
  return files;
}

/** Extrae las imágenes del documento (paso `captureId`) a enviar a NAAT-CHECK: primero intenta
 * `mediaAssets` (contenido embebido en base64), y si no hay ninguna — el caso real para
 * ejecuciones API_BY_STEPS — descarga las imágenes remotas de `files[]` (ver
 * `downloadRemoteDocumentFiles`). Nunca vuelve a tocar `responsePayload` crudo directamente. */
async function buildNaatCheckFiles(
  detail: NormalizedValidationDetail,
  execution: ExecutionWithEnvironment,
): Promise<NaatCheckFile[]> {
  const mediaAssetFiles = detail.mediaAssets
    .filter((asset) => asset.stepKey === "captureId")
    .map((asset) => {
      const [, mimeAndData] = asset.dataUrl.split(":", 2);
      const [mimeType, base64] = (mimeAndData ?? "").split(";base64,");
      return { file: base64 ?? "", type: mimeType || asset.mimeType, name: asset.label };
    })
    .filter((file) => file.file.length > 0);

  if (mediaAssetFiles.length > 0) return mediaAssetFiles;
  return downloadRemoteDocumentFiles(detail, execution);
}

/**
 * Dispara un recheck NAAT-CHECK manual sobre una ejecución ya existente (botón "Reevaluar con
 * NAAT-CHECK") — siempre en modo síncrono (ver `naat-check-client.ts`), nunca fabrica un
 * resultado: si NAAT-CHECK no está configurado/habilitado para el ambiente, si la ejecución no
 * tiene imágenes de documento capturadas, o si la llamada real falla, se lanza el error real. Solo
 * aplica a ejecuciones API_BY_STEPS (el flujo Web SDK ya tiene su propio NAAT-CHECK integrado).
 */
export async function triggerNaatCheckRecheck(
  executionId: string,
  scope: ClientScope | undefined,
  auditContext: AuditContext,
): Promise<NaatCheckRecheckResultDto> {
  const execution = await getExecutionOrThrow(executionId, scope);

  if (execution.environment.integrationModel !== "API_BY_STEPS") {
    throw AppError.badRequest(
      "El recheck manual de NAAT-CHECK solo aplica a ejecuciones del modelo API_BY_STEPS. El flujo Web SDK ya ejecuta su propio NAAT-CHECK dentro del mismo proceso.",
    );
  }

  const config = await getNaatCheckConfig(execution.environmentId);
  if (!config || !config.enabled) {
    throw AppError.badRequest(
      "NAAT-CHECK no está configurado/habilitado para este ambiente. Ve a Ambientes > NAAT-CHECK y completa la configuración.",
    );
  }
  const creds = decryptNaatCheckCredentials(config);
  if (!creds.username || !creds.password) {
    throw AppError.badRequest("NAAT-CHECK no tiene usuario/contraseña configurados para este ambiente.");
  }

  const detail = fromJsonField<NormalizedValidationDetail | null>(execution.normalizedResponse, null);
  if (!detail) {
    throw AppError.badRequest("Esta ejecución todavía no tiene un detalle normalizado disponible.");
  }
  const files = await buildNaatCheckFiles(detail, execution);

  await logAudit("NAAT_CHECK_RECHECK_REQUESTED", "ValidationExecution", executionId, auditContext, {
    fileCount: files.length,
  });

  let data;
  try {
    data = await requestNaatCheckRecheck(
      { environmentId: execution.environmentId, baseUrl: config.baseUrl, username: creds.username, password: creds.password },
      files,
    );
  } catch (error) {
    await logAudit("NAAT_CHECK_RECHECK_FAILED", "ValidationExecution", executionId, auditContext, {
      message: error instanceof Error ? error.message : "Error desconocido",
    });
    throw error;
  }

  if (!data) {
    throw AppError.upstream("NAAT-CHECK no devolvió un resultado.");
  }

  const result: NaatCheckRecheckResultDto = {
    risk: data.risk,
    key: data.key ?? null,
    result: data.result ?? data.risk === "LOW",
    requestedAt: new Date().toISOString(),
  };

  await prisma.validationExecution.update({
    where: { id: executionId },
    data: { naatCheckRecheckResult: toJsonField(result) },
  });
  await recomputeExecutionDetail(executionId, scope);

  await logAudit("NAAT_CHECK_RECHECK_COMPLETED", "ValidationExecution", executionId, auditContext, {
    risk: result.risk,
    key: result.key,
  });

  return result;
}

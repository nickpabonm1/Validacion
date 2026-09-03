import type { NaatCheckRecheckResultDto, NormalizedValidationDetail } from "@fad-console/shared-types";
import { prisma } from "../../lib/prisma";
import { fromJsonField, toJsonField } from "../../lib/json-field";
import { AppError } from "../../lib/errors";
import { logAudit, type AuditContext } from "../audit/audit.service";
import type { ClientScope } from "../clients/client-scope";
import { getExecutionOrThrow, recomputeExecutionDetail } from "../executions/executions.service";
import { decryptNaatCheckCredentials, getNaatCheckConfig } from "./naat-check-config.service";
import { requestNaatCheckRecheck, type NaatCheckFile } from "./naat-check-client";

/** Extrae la imagen frontal/posterior del documento (paso `captureId`, ya normalizadas en
 * `mediaAssets`) para enviarlas a NAAT-CHECK — nunca vuelve a tocar `responsePayload` crudo:
 * reutiliza exactamente lo que el reporte ya muestra en la galería de imágenes. */
function buildNaatCheckFiles(detail: NormalizedValidationDetail): NaatCheckFile[] {
  return detail.mediaAssets
    .filter((asset) => asset.stepKey === "captureId")
    .map((asset) => {
      const [, mimeAndData] = asset.dataUrl.split(":", 2);
      const [mimeType, base64] = (mimeAndData ?? "").split(";base64,");
      return { file: base64 ?? "", type: mimeType || asset.mimeType, name: asset.label };
    })
    .filter((file) => file.file.length > 0);
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
  const files = buildNaatCheckFiles(detail);

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

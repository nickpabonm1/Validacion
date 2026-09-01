import type { ValidationExecutionListItemDto } from "@fad-console/shared-types";
import {
  ValidationRequestConfigSchema,
  pruneEmptyRequestFields,
  type ValidationRequestConfig,
  type CreateValidationResponse,
  type GetValidationStepResponse,
  type GetValidationDataResponse,
} from "@fad-console/validation-schemas";
import { prisma } from "../../lib/prisma";
import { fromJsonField, toJsonField } from "../../lib/json-field";
import { AppError } from "../../lib/errors";
import { logger } from "../../lib/logger";
import { credentialEncryptionService } from "../credentials/credential-encryption.service";
import { fadApiAdapter } from "../fad-adapter/fad-api-adapter";
import { fadDemoAdapter } from "../fad-adapter/fad-demo-adapter";
import { hasMinimumCredentials, getEnvironmentOrThrow } from "../environments/environments.service";
import { buildNormalizedValidationDetail } from "../../normalize/validation-detail";
import { maskEmail, maskName } from "../../normalize/mask";
import { normalizeValidationStatus, normalizeResult } from "../../normalize/status";

interface StoredResponses {
  create: CreateValidationResponse | null;
  step: GetValidationStepResponse | null;
  data: GetValidationDataResponse | null;
}

type ExecutionRecord = Awaited<ReturnType<typeof prisma.validationExecution.findFirstOrThrow>>;

function adapterFor(isDemo: boolean) {
  return isDemo ? fadDemoAdapter : fadApiAdapter;
}

async function recomputeAndPersist(
  execution: ExecutionRecord,
  environmentName: string,
  templateName: string | null,
): Promise<ExecutionRecord> {
  const responses = fromJsonField<StoredResponses>(execution.responsePayload, { create: null, step: null, data: null });
  const requestPayload = fromJsonField<ValidationRequestConfig>(execution.requestPayload, {
    processName: execution.processName,
    validity: 1,
    client: { name: null as unknown as string, mail: null as unknown as string, phone: null as unknown as string },
    steps: {},
    customization: { theme: [], header: [] },
    feature: {},
    notifications: { email: false, whatsapp: false },
  });

  const stepTimestamps: Record<string, { startedAt: string | null; completedAt: string | null }> = {};
  const stepRows = await prisma.validationStepExecution.findMany({ where: { validationExecutionId: execution.id } });
  for (const row of stepRows) {
    stepTimestamps[row.stepKey] = {
      startedAt: row.startedAt ? row.startedAt.toISOString() : null,
      completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    };
  }

  const detail = buildNormalizedValidationDetail({
    validationId: execution.validationId,
    processName: execution.processName,
    environmentName,
    templateName,
    requestSteps: requestPayload.steps,
    fallbackClient: requestPayload.client,
    createResponse: responses.create,
    stepResponse: responses.step,
    dataResponse: responses.data,
    stepTimestamps,
  });

  const completedAt = detail.status === "COMPLETED" && detail.completedAt ? new Date(detail.completedAt) : execution.completedAt;

  return prisma.validationExecution.update({
    where: { id: execution.id },
    data: {
      normalizedResponse: toJsonField(detail),
      rawStatus: detail.rawStatus,
      normalizedStatus: detail.status,
      result: detail.result,
      lastSyncedAt: new Date(),
      completedAt,
    },
  });
}

export function toExecutionListItemDto(
  execution: ExecutionRecord & { environment: { name: string }; template: { name: string } | null; createdBy: { name: string } | null },
): ValidationExecutionListItemDto {
  return {
    id: execution.id,
    validationId: execution.validationId,
    processName: execution.processName,
    environmentName: execution.environment.name,
    templateName: execution.template?.name ?? null,
    clientNameMasked: execution.clientNameMasked,
    clientEmailMasked: execution.clientEmailMasked,
    normalizedStatus: execution.normalizedStatus,
    rawStatus: execution.rawStatus,
    result: execution.result,
    isDemo: execution.isDemo,
    startedAt: execution.startedAt ? execution.startedAt.toISOString() : null,
    completedAt: execution.completedAt ? execution.completedAt.toISOString() : null,
    lastSyncedAt: execution.lastSyncedAt ? execution.lastSyncedAt.toISOString() : null,
    createdAt: execution.createdAt.toISOString(),
    createdByName: execution.createdBy?.name ?? null,
  };
}

export interface ExecutionFilters {
  status?: string;
  environmentId?: string;
  templateId?: string;
  search?: string;
}

export async function listExecutions(filters: ExecutionFilters) {
  const where: Record<string, unknown> = {};
  if (filters.status) where.normalizedStatus = filters.status;
  if (filters.environmentId) where.environmentId = filters.environmentId;
  if (filters.templateId) where.templateId = filters.templateId;
  if (filters.search) {
    where.OR = [
      { validationId: { contains: filters.search } },
      { processName: { contains: filters.search } },
      { clientEmailMasked: { contains: filters.search } },
    ];
  }
  return prisma.validationExecution.findMany({
    where,
    include: { environment: true, template: true, createdBy: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export async function getExecutionOrThrow(id: string) {
  const execution = await prisma.validationExecution.findUnique({
    where: { id },
    include: { environment: true, template: true, steps: true, webhookEvents: { orderBy: { receivedAt: "desc" } } },
  });
  if (!execution) throw AppError.notFound("Ejecución no encontrada");
  return execution;
}

export async function createExecution(params: {
  environmentId: string;
  templateId?: string | null;
  requestConfig: unknown;
  userId: string | null;
  demo: boolean;
}) {
  const environment = await getEnvironmentOrThrow(params.environmentId);
  const parsedConfig = ValidationRequestConfigSchema.parse(params.requestConfig);

  if (!params.demo && !hasMinimumCredentials(environment)) {
    throw AppError.badRequest(
      "Debes configurar una conexión API antes de ejecutar la validación. Ve a Configuración > Conexiones API.",
    );
  }

  const requestBody = pruneEmptyRequestFields(parsedConfig);
  const adapter = adapterFor(params.demo);
  const { data: createResponse } = await adapter.createValidation(environment, requestBody);

  if (!createResponse.success || !createResponse.data) {
    throw AppError.upstream(createResponse.error ?? "FAD rechazó la creación de la validación", {
      code: createResponse.code,
    });
  }

  const keyEncrypted = credentialEncryptionService.encrypt(createResponse.data.key);
  const vectorEncrypted = credentialEncryptionService.encrypt(createResponse.data.vector);

  const stored: StoredResponses = { create: createResponse, step: null, data: null };

  const execution = await prisma.validationExecution.create({
    data: {
      validationId: createResponse.data.validationId,
      processName: parsedConfig.processName,
      environmentId: environment.id,
      templateId: params.templateId ?? null,
      requestPayload: toJsonField(parsedConfig),
      responsePayload: toJsonField(stored),
      normalizedResponse: null,
      rawStatus: null,
      normalizedStatus: "CREATED",
      result: null,
      clientNameMasked: maskName(parsedConfig.client.name),
      clientEmailMasked: maskEmail(parsedConfig.client.mail),
      keyEncrypted,
      vectorEncrypted,
      isDemo: params.demo,
      startedAt: new Date(),
      createdById: params.userId,
    },
  });

  await prisma.validationStepExecution.createMany({
    data: Object.entries(parsedConfig.steps).map(([stepKey, step]) => ({
      validationExecutionId: execution.id,
      stepKey,
      order: step.order,
      show: step.show,
      status: "PENDING",
      configuration: toJsonField(step.configuration ?? {}),
      features: toJsonField(step.features ?? {}),
      input: step.input ? toJsonField(step.input) : null,
    })),
  });

  const templateName = params.templateId
    ? (await prisma.validationTemplate.findUnique({ where: { id: params.templateId } }))?.name ?? null
    : null;
  const updated = await recomputeAndPersist(execution, environment.name, templateName);
  return updated;
}

export async function syncExecutionStatus(id: string) {
  const execution = await getExecutionOrThrow(id);
  const environment = execution.environment;
  const adapter = adapterFor(execution.isDemo);

  if (!execution.validationId) {
    throw AppError.badRequest("La ejecución no tiene un validationId asociado");
  }

  const stored = fromJsonField<StoredResponses>(execution.responsePayload, { create: null, step: null, data: null });

  let stepResponse: GetValidationStepResponse | null = stored.step;
  let dataResponse: GetValidationDataResponse | null = stored.data;

  try {
    const stepResult = await adapter.getValidationStep(environment, execution.validationId);
    stepResponse = stepResult.data;
  } catch (error) {
    logger.warn("No se pudo consultar getValidationStep", { executionId: id, error: (error as Error).message });
  }
  try {
    const dataResult = await adapter.getValidationData(environment, execution.validationId);
    dataResponse = dataResult.data;
  } catch (error) {
    logger.warn("No se pudo consultar getValidationData", { executionId: id, error: (error as Error).message });
  }

  const updatedStored: StoredResponses = { create: stored.create, step: stepResponse, data: dataResponse };
  await prisma.validationExecution.update({
    where: { id },
    data: { responsePayload: toJsonField(updatedStored) },
  });

  if (stepResponse?.data?.steps) {
    for (const [stepKey, stepInfo] of Object.entries(stepResponse.data.steps)) {
      const info = stepInfo as Record<string, unknown>;
      const status = typeof info.status === "string" ? info.status : "UNKNOWN";
      await prisma.validationStepExecution.upsert({
        where: { validationExecutionId_stepKey: { validationExecutionId: id, stepKey } },
        update: {
          status,
          order: typeof info.order === "number" ? info.order : undefined,
          show: typeof info.show === "boolean" ? info.show : undefined,
          configuration: info.configuration ? toJsonField(info.configuration) : undefined,
          features: info.features ? toJsonField(info.features) : undefined,
          data: info.data !== undefined ? toJsonField(info.data) : undefined,
          completedAt: status === "COMPLETED" ? new Date() : undefined,
        },
        create: {
          validationExecutionId: id,
          stepKey,
          order: typeof info.order === "number" ? info.order : 0,
          show: typeof info.show === "boolean" ? info.show : true,
          status,
          configuration: info.configuration ? toJsonField(info.configuration) : null,
          features: info.features ? toJsonField(info.features) : null,
          data: info.data !== undefined ? toJsonField(info.data) : null,
        },
      });
    }
  }

  const templateName = execution.templateId
    ? (await prisma.validationTemplate.findUnique({ where: { id: execution.templateId } }))?.name ?? null
    : null;
  const refreshed = await prisma.validationExecution.findUniqueOrThrow({ where: { id } });
  return recomputeAndPersist(refreshed, environment.name, templateName);
}

export async function revealExecutionSecret(id: string, field: "key" | "vector"): Promise<string> {
  const execution = await getExecutionOrThrow(id);
  const encrypted = field === "key" ? execution.keyEncrypted : execution.vectorEncrypted;
  if (!encrypted) throw AppError.notFound("El valor solicitado no está disponible");
  return credentialEncryptionService.decrypt(encrypted);
}

export function maskSecret(value: string): string {
  if (value.length <= 4) return "*".repeat(value.length);
  return `${value.slice(0, 2)}${"*".repeat(Math.max(value.length - 4, 4))}${value.slice(-2)}`;
}

export async function saveValidationStepPassthrough(executionId: string, stepKey: string, encryptedPayload: string) {
  const execution = await getExecutionOrThrow(executionId);
  if (!execution.validationId) throw AppError.badRequest("La ejecución no tiene un validationId asociado");
  if (execution.isDemo) {
    throw AppError.badRequest("No se puede guardar un paso real sobre una ejecución en modo demostración");
  }
  const result = await fadApiAdapter.saveValidationStep(execution.environment, execution.validationId, encryptedPayload);
  await prisma.validationStepExecution.updateMany({
    where: { validationExecutionId: executionId, stepKey },
    data: { status: result.data.success ? "COMPLETED" : "FAILED", completedAt: new Date() },
  });
  return result.data;
}

export function deriveNormalizedStatusFromRaw(raw: string | null): string {
  return normalizeValidationStatus(raw);
}
export function deriveNormalizedResultFromRaw(raw: string | null): string {
  return normalizeResult(raw);
}

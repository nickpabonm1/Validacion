import { Router } from "express";
import { z } from "zod";
import { ExecuteValidationInputSchema } from "@fad-console/validation-schemas";
import { fromJsonField } from "../../lib/json-field";
import { requireAuth, requireRole, auditContextFrom } from "../auth/auth.middleware";
import { logAudit } from "../audit/audit.service";
import {
  createExecution,
  getExecutionOrThrow,
  listExecutions,
  maskSecret,
  revealExecutionSecret,
  saveValidationStepPassthrough,
  syncExecutionStatus,
  toExecutionListItemDto,
} from "./executions.service";

export const executionsRouter = Router();

executionsRouter.use(requireAuth);

executionsRouter.get("/", async (req, res, next) => {
  try {
    const query = z
      .object({
        status: z.string().optional(),
        environmentId: z.string().optional(),
        templateId: z.string().optional(),
        search: z.string().optional(),
      })
      .parse(req.query);
    const executions = await listExecutions(query);
    res.json({ executions: executions.map(toExecutionListItemDto) });
  } catch (error) {
    next(error);
  }
});

function toDetailDto(execution: Awaited<ReturnType<typeof getExecutionOrThrow>>) {
  return {
    id: execution.id,
    validationId: execution.validationId,
    processName: execution.processName,
    environment: { id: execution.environment.id, name: execution.environment.name },
    template: execution.template ? { id: execution.template.id, name: execution.template.name } : null,
    normalizedStatus: execution.normalizedStatus,
    rawStatus: execution.rawStatus,
    result: execution.result,
    isDemo: execution.isDemo,
    clientNameMasked: execution.clientNameMasked,
    clientEmailMasked: execution.clientEmailMasked,
    keyMasked: execution.keyEncrypted ? "••••••••" : null,
    vectorMasked: execution.vectorEncrypted ? "••••••••" : null,
    startedAt: execution.startedAt?.toISOString() ?? null,
    completedAt: execution.completedAt?.toISOString() ?? null,
    lastSyncedAt: execution.lastSyncedAt?.toISOString() ?? null,
    createdAt: execution.createdAt.toISOString(),
    normalized: fromJsonField(execution.normalizedResponse, null),
    requestPayload: fromJsonField(execution.requestPayload, null),
    steps: execution.steps.map((s) => ({
      id: s.id,
      stepKey: s.stepKey,
      order: s.order,
      show: s.show,
      status: s.status,
      configuration: fromJsonField(s.configuration, {}),
      features: fromJsonField(s.features, {}),
      data: fromJsonField(s.data, null),
      startedAt: s.startedAt?.toISOString() ?? null,
      completedAt: s.completedAt?.toISOString() ?? null,
    })),
    webhookEvents: execution.webhookEvents.map((w) => ({
      id: w.id,
      eventType: w.eventType,
      receivedAt: w.receivedAt.toISOString(),
      processingStatus: w.processingStatus,
      retry: w.retry,
    })),
  };
}

executionsRouter.get("/:id", async (req, res, next) => {
  try {
    const execution = await getExecutionOrThrow(req.params.id as string);
    res.json({ execution: toDetailDto(execution) });
  } catch (error) {
    next(error);
  }
});

executionsRouter.post("/", requireRole("ADMIN", "OPERATOR"), async (req, res, next) => {
  try {
    const input = ExecuteValidationInputSchema.parse(req.body);
    const execution = await createExecution({
      environmentId: input.environmentId,
      templateId: input.templateId ?? null,
      requestConfig: input.requestConfig,
      userId: req.user!.sub,
      demo: false,
    });
    await logAudit("EXECUTE_VALIDATION", "ValidationExecution", execution.id, auditContextFrom(req), {
      environmentId: input.environmentId,
      demo: false,
    });
    res.status(201).json({ execution: toDetailDto(await getExecutionOrThrow(execution.id)) });
  } catch (error) {
    next(error);
  }
});

executionsRouter.post("/demo", requireRole("ADMIN", "OPERATOR"), async (req, res, next) => {
  try {
    const input = ExecuteValidationInputSchema.parse(req.body);
    const execution = await createExecution({
      environmentId: input.environmentId,
      templateId: input.templateId ?? null,
      requestConfig: input.requestConfig,
      userId: req.user!.sub,
      demo: true,
    });
    await logAudit("EXECUTE_VALIDATION", "ValidationExecution", execution.id, auditContextFrom(req), {
      environmentId: input.environmentId,
      demo: true,
    });
    res.status(201).json({ execution: toDetailDto(await getExecutionOrThrow(execution.id)) });
  } catch (error) {
    next(error);
  }
});

executionsRouter.post("/:id/sync", requireRole("ADMIN", "OPERATOR", "AUDITOR"), async (req, res, next) => {
  try {
    await syncExecutionStatus(req.params.id as string);
    await logAudit("QUERY_VALIDATION", "ValidationExecution", req.params.id as string, auditContextFrom(req));
    res.json({ execution: toDetailDto(await getExecutionOrThrow(req.params.id as string)) });
  } catch (error) {
    next(error);
  }
});

executionsRouter.post("/:id/reveal/:field", requireRole("ADMIN", "OPERATOR"), async (req, res, next) => {
  try {
    const field = z.enum(["key", "vector"]).parse(req.params.field);
    const value = await revealExecutionSecret(req.params.id as string, field);
    await logAudit("REVEAL_SECRET", "ValidationExecution", req.params.id as string, auditContextFrom(req), { field });
    res.json({ value, masked: maskSecret(value) });
  } catch (error) {
    next(error);
  }
});

executionsRouter.post("/:id/steps/:stepKey/save", requireRole("ADMIN", "OPERATOR"), async (req, res, next) => {
  try {
    const body = z.object({ encryptedPayload: z.string().min(1) }).parse(req.body);
    const result = await saveValidationStepPassthrough(
      req.params.id as string,
      req.params.stepKey as string,
      body.encryptedPayload,
    );
    await logAudit("UPDATE", "ValidationStepExecution", req.params.id as string, auditContextFrom(req), {
      stepKey: req.params.stepKey,
    });
    res.json({ result });
  } catch (error) {
    next(error);
  }
});

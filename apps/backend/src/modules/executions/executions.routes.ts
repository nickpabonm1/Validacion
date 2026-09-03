import { Router } from "express";
import { z } from "zod";
import { ExecuteValidationInputSchema, SendExecutionEmailInputSchema } from "@fad-console/validation-schemas";
import { requireAuth, requireRole, auditContextFrom } from "../auth/auth.middleware";
import { logAudit } from "../audit/audit.service";
import { buildClientScope } from "../clients/client-scope";
import { sendShareLinkEmail } from "../messaging/email.service";
import { triggerNaatCheckRecheck } from "../naat-check/naat-check.service";
import {
  createExecution,
  getExecutionOrThrow,
  listExecutions,
  maskSecret,
  revealExecutionSecret,
  saveValidationStepPassthrough,
  syncExecutionStatus,
  toDetailDto,
  toExecutionListItemDto,
} from "./executions.service";
import { getEnvironmentOrThrow } from "../environments/environments.service";

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
    const scope = await buildClientScope(req.user!);
    const executions = await listExecutions(query, scope);
    res.json({ executions: executions.map(toExecutionListItemDto) });
  } catch (error) {
    next(error);
  }
});

executionsRouter.get("/:id", async (req, res, next) => {
  try {
    const scope = await buildClientScope(req.user!);
    const execution = await getExecutionOrThrow(req.params.id as string, scope);
    res.json({ execution: toDetailDto(execution) });
  } catch (error) {
    next(error);
  }
});

executionsRouter.post("/", requireRole("ADMIN", "OPERATOR", "LAUNCHER"), async (req, res, next) => {
  try {
    const scope = await buildClientScope(req.user!);
    const input = ExecuteValidationInputSchema.parse(req.body);
    await getEnvironmentOrThrow(input.environmentId, scope);
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
    const scope = await buildClientScope(req.user!);
    const input = ExecuteValidationInputSchema.parse(req.body);
    await getEnvironmentOrThrow(input.environmentId, scope);
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

executionsRouter.post("/:id/sync", requireRole("ADMIN", "OPERATOR", "AUDITOR", "LAUNCHER"), async (req, res, next) => {
  try {
    const scope = await buildClientScope(req.user!);
    await getExecutionOrThrow(req.params.id as string, scope);
    await syncExecutionStatus(req.params.id as string);
    await logAudit("QUERY_VALIDATION", "ValidationExecution", req.params.id as string, auditContextFrom(req));
    res.json({ execution: toDetailDto(await getExecutionOrThrow(req.params.id as string)) });
  } catch (error) {
    next(error);
  }
});

/** Envía el enlace de captura (ya armado en el frontend con key/vector revelados, ver
 * `ShareLinkPanel`) por correo, con la plantilla propia del cliente dueño del ambiente (o la
 * heredada, o la de la consola por defecto — ver `email.service.ts`). */
executionsRouter.post("/:id/send-email", requireRole("ADMIN", "OPERATOR", "LAUNCHER"), async (req, res, next) => {
  try {
    const scope = await buildClientScope(req.user!);
    const execution = await getExecutionOrThrow(req.params.id as string, scope);
    const input = SendExecutionEmailInputSchema.parse(req.body);
    const result = await sendShareLinkEmail({
      to: input.to,
      processName: execution.processName,
      environmentName: execution.environment.name,
      publicUrl: input.publicUrl,
      clientId: execution.environment.clientId,
    });
    await logAudit("SHARE_LINK_SENT", "ValidationExecution", execution.id, auditContextFrom(req), { channel: "EMAIL" });
    res.json({ delivered: true, messageId: result.messageId });
  } catch (error) {
    next(error);
  }
});

/** Reevalúa el riesgo de un documento ya capturado contra NAAT-CHECK (NAAT.TECH "API RECHECK
 * PROCESS") — fuera del flujo principal, bajo pedido. Ver `naat-check.service.ts` para el porqué
 * solo aplica a ejecuciones API_BY_STEPS. */
executionsRouter.post("/:id/naat-check", requireRole("ADMIN", "OPERATOR"), async (req, res, next) => {
  try {
    const scope = await buildClientScope(req.user!);
    const result = await triggerNaatCheckRecheck(req.params.id as string, scope, auditContextFrom(req));
    res.json({ result });
  } catch (error) {
    next(error);
  }
});

executionsRouter.post("/:id/reveal/:field", requireRole("ADMIN", "OPERATOR"), async (req, res, next) => {
  try {
    const scope = await buildClientScope(req.user!);
    await getExecutionOrThrow(req.params.id as string, scope);
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
    const scope = await buildClientScope(req.user!);
    await getExecutionOrThrow(req.params.id as string, scope);
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

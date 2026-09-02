import { Router } from "express";
import { WebSdkStartInputSchema, WebSdkAcuantResultInputSchema, WebSdkFacetecResultInputSchema } from "@fad-console/validation-schemas";
import { requireAuth, requireRole, auditContextFrom } from "../auth/auth.middleware";
import { logAudit } from "../audit/audit.service";
import { getExecutionOrThrow, toDetailDto } from "../executions/executions.service";
import { completeWebSdkExecution, startWebSdkExecution, submitAcuantResult, submitFacetecResult } from "./websdk-flow.service";

export const websdkFlowRouter = Router();

websdkFlowRouter.use(requireAuth);

websdkFlowRouter.post("/start", requireRole("ADMIN", "OPERATOR"), async (req, res, next) => {
  try {
    const input = WebSdkStartInputSchema.parse(req.body);
    const { executionId, sdkInit } = await startWebSdkExecution(input, req.user?.sub ?? null);
    await logAudit("EXECUTE_VALIDATION", "ValidationExecution", executionId, auditContextFrom(req), {
      integrationModel: "WEB_SDK",
    });
    res.status(201).json({ executionId, sdkInit });
  } catch (error) {
    next(error);
  }
});

websdkFlowRouter.post("/:id/acuant-result", requireRole("ADMIN", "OPERATOR"), async (req, res, next) => {
  try {
    const input = WebSdkAcuantResultInputSchema.parse(req.body);
    const result = await submitAcuantResult(req.params.id as string, input);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

websdkFlowRouter.post("/:id/facetec-result", requireRole("ADMIN", "OPERATOR"), async (req, res, next) => {
  try {
    const input = WebSdkFacetecResultInputSchema.parse(req.body);
    await submitFacetecResult(req.params.id as string, input);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

websdkFlowRouter.post("/:id/complete", requireRole("ADMIN", "OPERATOR"), async (req, res, next) => {
  try {
    const result = await completeWebSdkExecution(req.params.id as string);
    const execution = await getExecutionOrThrow(result.executionId);
    await logAudit("QUERY_VALIDATION", "ValidationExecution", result.executionId, auditContextFrom(req), {
      normalizedStatus: execution.normalizedStatus,
    });
    res.json({ execution: toDetailDto(execution) });
  } catch (error) {
    next(error);
  }
});

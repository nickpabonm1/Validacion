import { Router } from "express";
import rateLimit from "express-rate-limit";
import { WebSdkAcuantResultInputSchema, WebSdkFacetecResultInputSchema } from "@fad-console/validation-schemas";
import { logAudit } from "../audit/audit.service";
import { auditContextFrom } from "../auth/auth.middleware";
import {
  completeWebSdkExecution,
  getSdkInitForExecution,
  startWebSdkExecution,
  submitAcuantResult,
  submitFacetecResult,
} from "./websdk-flow.service";
import {
  getPublicShareInfo,
  markShareLinkCompleted,
  markShareLinkStarted,
  resolveExecutionId,
  resolveStartInput,
} from "./websdk-share.service";

/** Rutas públicas (SIN `requireAuth`/cookie de sesión) para el enlace de captura compartido: el
 * cliente final las abre en su propio celular desde el QR/correo/WhatsApp. El `token` opaco de
 * un solo uso (ver websdk-share.service.ts) es la única credencial — nunca se acepta un
 * `executionId` directamente del cuerpo de la petición, siempre se re-deriva del token. */
export const websdkSharePublicRouter = Router();

const shareLinkLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
});
websdkSharePublicRouter.use(shareLinkLimiter);

websdkSharePublicRouter.get("/:token", async (req, res, next) => {
  try {
    const info = await getPublicShareInfo(req.params.token as string);
    res.json({ info });
  } catch (error) {
    next(error);
  }
});

websdkSharePublicRouter.post("/:token/start", async (req, res, next) => {
  try {
    const token = req.params.token as string;
    const resolved = await resolveStartInput(token);

    if (resolved.existingExecutionId) {
      const sdkInit = await getSdkInitForExecution(resolved.existingExecutionId);
      res.json({ executionId: resolved.existingExecutionId, sdkInit });
      return;
    }

    const { executionId, sdkInit } = await startWebSdkExecution(
      {
        environmentId: resolved.environmentId,
        templateId: resolved.templateId,
        processName: resolved.processName ?? undefined,
        client: resolved.client,
      },
      null,
    );
    await markShareLinkStarted(token, executionId);
    await logAudit(
      "EXECUTE_VALIDATION",
      "ValidationExecution",
      executionId,
      auditContextFrom(req),
      { integrationModel: "WEB_SDK", via: "shareLink" },
    );
    res.status(201).json({ executionId, sdkInit });
  } catch (error) {
    next(error);
  }
});

websdkSharePublicRouter.post("/:token/acuant-result", async (req, res, next) => {
  try {
    const executionId = await resolveExecutionId(req.params.token as string);
    const input = WebSdkAcuantResultInputSchema.parse(req.body);
    const result = await submitAcuantResult(executionId, input);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

websdkSharePublicRouter.post("/:token/facetec-result", async (req, res, next) => {
  try {
    const executionId = await resolveExecutionId(req.params.token as string);
    const input = WebSdkFacetecResultInputSchema.parse(req.body);
    await submitFacetecResult(executionId, input);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

websdkSharePublicRouter.post("/:token/complete", async (req, res, next) => {
  try {
    const token = req.params.token as string;
    const executionId = await resolveExecutionId(token);
    const result = await completeWebSdkExecution(executionId);
    await markShareLinkCompleted(token);
    await logAudit("QUERY_VALIDATION", "ValidationExecution", result.executionId, auditContextFrom(req), { via: "shareLink" });
    res.json({ executionId: result.executionId });
  } catch (error) {
    next(error);
  }
});

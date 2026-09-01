import { Router } from "express";
import { ResponseViewInputSchema } from "@fad-console/validation-schemas";
import { fromJsonField } from "../../lib/json-field";
import { AppError } from "../../lib/errors";
import { requireAuth, requireRole, auditContextFrom } from "../auth/auth.middleware";
import { logAudit } from "../audit/audit.service";
import { getExecutionOrThrow } from "../executions/executions.service";
import {
  createResponseView,
  deleteResponseView,
  getResponseViewOrThrow,
  listResponseViews,
  toResponseViewDto,
  updateResponseView,
} from "./response-views.service";
import { projectResponseView, type ResponseViewConfigShape } from "./projection";

export const responseViewsRouter = Router();

responseViewsRouter.use(requireAuth);

responseViewsRouter.get("/", async (_req, res, next) => {
  try {
    const views = await listResponseViews();
    res.json({ views: views.map(toResponseViewDto) });
  } catch (error) {
    next(error);
  }
});

responseViewsRouter.get("/:id", async (req, res, next) => {
  try {
    const view = await getResponseViewOrThrow(req.params.id as string);
    res.json({ view: toResponseViewDto(view) });
  } catch (error) {
    next(error);
  }
});

responseViewsRouter.post("/", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const input = ResponseViewInputSchema.parse(req.body);
    const view = await createResponseView(input);
    await logAudit("CREATE", "ResponseView", view.id, auditContextFrom(req), { name: view.name });
    res.status(201).json({ view: toResponseViewDto(view) });
  } catch (error) {
    next(error);
  }
});

responseViewsRouter.put("/:id", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const input = ResponseViewInputSchema.parse(req.body);
    const view = await updateResponseView(req.params.id as string, input);
    await logAudit("UPDATE", "ResponseView", view.id, auditContextFrom(req), { name: view.name });
    res.json({ view: toResponseViewDto(view) });
  } catch (error) {
    next(error);
  }
});

responseViewsRouter.delete("/:id", requireRole("ADMIN"), async (req, res, next) => {
  try {
    await deleteResponseView(req.params.id as string);
    await logAudit("DELETE", "ResponseView", req.params.id as string, auditContextFrom(req));
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

/** Aplica una vista de respuesta sobre una ejecución concreta (usado por el detalle de
 * validación para renderizar paneles configurables). */
responseViewsRouter.get("/:id/apply/:executionId", async (req, res, next) => {
  try {
    const view = await getResponseViewOrThrow(req.params.id as string);
    const execution = await getExecutionOrThrow(req.params.executionId as string);
    const detail = fromJsonField(execution.normalizedResponse, null);
    if (!detail) throw AppError.badRequest("La ejecución todavía no tiene información normalizada");
    const config = fromJsonField<ResponseViewConfigShape>(view.configuration, { fields: [] });
    const fields = projectResponseView(detail, config, req.user!.role);
    res.json({ fields });
  } catch (error) {
    next(error);
  }
});

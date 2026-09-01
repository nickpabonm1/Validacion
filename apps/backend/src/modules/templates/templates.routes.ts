import { Router } from "express";
import { ValidationTemplateInputSchema } from "@fad-console/validation-schemas";
import { requireAuth, requireRole, auditContextFrom } from "../auth/auth.middleware";
import { logAudit } from "../audit/audit.service";
import {
  cloneTemplate,
  createTemplate,
  deleteTemplate,
  getTemplateOrThrow,
  listTemplates,
  toTemplateDto,
  updateTemplate,
} from "./templates.service";

export const templatesRouter = Router();

templatesRouter.use(requireAuth);

templatesRouter.get("/", async (_req, res, next) => {
  try {
    const templates = await listTemplates();
    res.json({ templates: templates.map(toTemplateDto) });
  } catch (error) {
    next(error);
  }
});

templatesRouter.get("/:id", async (req, res, next) => {
  try {
    const template = await getTemplateOrThrow(req.params.id as string);
    res.json({ template: toTemplateDto(template) });
  } catch (error) {
    next(error);
  }
});

templatesRouter.post("/", requireRole("ADMIN", "OPERATOR"), async (req, res, next) => {
  try {
    const input = ValidationTemplateInputSchema.parse(req.body);
    const template = await createTemplate(input, req.user!.sub);
    await logAudit("CREATE", "ValidationTemplate", template.id, auditContextFrom(req), { name: template.name });
    res.status(201).json({ template: toTemplateDto(template) });
  } catch (error) {
    next(error);
  }
});

templatesRouter.put("/:id", requireRole("ADMIN", "OPERATOR"), async (req, res, next) => {
  try {
    const input = ValidationTemplateInputSchema.parse(req.body);
    const template = await updateTemplate(req.params.id as string, input, req.user!.sub);
    await logAudit("UPDATE", "ValidationTemplate", template.id, auditContextFrom(req), { name: template.name });
    res.json({ template: toTemplateDto(template) });
  } catch (error) {
    next(error);
  }
});

templatesRouter.post("/:id/clone", requireRole("ADMIN", "OPERATOR"), async (req, res, next) => {
  try {
    const template = await cloneTemplate(req.params.id as string, req.user!.sub);
    await logAudit("CREATE", "ValidationTemplate", template.id, auditContextFrom(req), { clonedFrom: req.params.id });
    res.status(201).json({ template: toTemplateDto(template) });
  } catch (error) {
    next(error);
  }
});

templatesRouter.delete("/:id", requireRole("ADMIN"), async (req, res, next) => {
  try {
    await deleteTemplate(req.params.id as string);
    await logAudit("DELETE", "ValidationTemplate", req.params.id as string, auditContextFrom(req));
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

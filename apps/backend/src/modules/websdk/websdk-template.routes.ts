import { Router } from "express";
import { z } from "zod";
import { WebSdkTemplateInputSchema } from "@fad-console/validation-schemas";
import { requireAuth, requireRole, auditContextFrom } from "../auth/auth.middleware";
import { logAudit } from "../audit/audit.service";
import { buildClientScope } from "../clients/client-scope";
import {
  createWebSdkTemplate,
  deleteWebSdkTemplate,
  getWebSdkTemplateOrThrow,
  listWebSdkTemplates,
  toWebSdkTemplateDto,
  updateWebSdkTemplate,
} from "./websdk-template.service";

export const websdkTemplateRouter = Router();

websdkTemplateRouter.use(requireAuth);

const ListQuerySchema = z.object({ environmentId: z.string().min(1) });

websdkTemplateRouter.get("/", requireRole("ADMIN", "OPERATOR", "AUDITOR", "LAUNCHER"), async (req, res, next) => {
  try {
    const { environmentId } = ListQuerySchema.parse(req.query);
    const scope = await buildClientScope(req.user!);
    const templates = await listWebSdkTemplates(environmentId, scope);
    res.json({ templates: templates.map(toWebSdkTemplateDto) });
  } catch (error) {
    next(error);
  }
});

websdkTemplateRouter.get("/:id", requireRole("ADMIN", "OPERATOR", "AUDITOR", "LAUNCHER"), async (req, res, next) => {
  try {
    const scope = await buildClientScope(req.user!);
    const template = await getWebSdkTemplateOrThrow(req.params.id as string, scope);
    res.json({ template: toWebSdkTemplateDto(template) });
  } catch (error) {
    next(error);
  }
});

websdkTemplateRouter.post("/", requireRole("ADMIN", "OPERATOR"), async (req, res, next) => {
  try {
    const scope = await buildClientScope(req.user!);
    const input = WebSdkTemplateInputSchema.parse(req.body);
    const template = await createWebSdkTemplate(input, req.user!.sub, scope);
    await logAudit("CREATE", "WebSdkTemplate", template.id, auditContextFrom(req), { name: template.name });
    res.status(201).json({ template: toWebSdkTemplateDto(template) });
  } catch (error) {
    next(error);
  }
});

websdkTemplateRouter.put("/:id", requireRole("ADMIN", "OPERATOR"), async (req, res, next) => {
  try {
    const scope = await buildClientScope(req.user!);
    const input = WebSdkTemplateInputSchema.parse(req.body);
    const template = await updateWebSdkTemplate(req.params.id as string, input, req.user!.sub, scope);
    await logAudit("UPDATE", "WebSdkTemplate", template.id, auditContextFrom(req), { name: template.name });
    res.json({ template: toWebSdkTemplateDto(template) });
  } catch (error) {
    next(error);
  }
});

websdkTemplateRouter.delete("/:id", requireRole("ADMIN", "OPERATOR"), async (req, res, next) => {
  try {
    const scope = await buildClientScope(req.user!);
    await deleteWebSdkTemplate(req.params.id as string, scope);
    await logAudit("DELETE", "WebSdkTemplate", req.params.id as string, auditContextFrom(req));
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

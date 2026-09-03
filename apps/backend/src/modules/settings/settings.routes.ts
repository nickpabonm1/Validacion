import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole, auditContextFrom } from "../auth/auth.middleware";
import { logAudit } from "../audit/audit.service";
import { buildClientScope } from "../clients/client-scope";
import { deleteSetting, getDashboardStats, listSettings, upsertSetting } from "./settings.service";

export const settingsRouter = Router();

settingsRouter.use(requireAuth);

settingsRouter.get("/dashboard", async (req, res, next) => {
  try {
    const scope = await buildClientScope(req.user!);
    const stats = await getDashboardStats(scope);
    res.json({ stats });
  } catch (error) {
    next(error);
  }
});

settingsRouter.get("/", requireRole("ADMIN"), async (_req, res, next) => {
  try {
    const settings = await listSettings();
    res.json({ settings });
  } catch (error) {
    next(error);
  }
});

const SettingInputSchema = z.object({
  value: z.string().min(1),
  description: z.string().max(300).optional(),
  encrypted: z.boolean().default(false),
});

settingsRouter.put("/:key", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const input = SettingInputSchema.parse(req.body);
    const setting = await upsertSetting(req.params.key as string, input.value, input.description, input.encrypted, req.user!.sub);
    await logAudit("UPDATE", "SystemSetting", setting.key, auditContextFrom(req));
    res.json({ key: setting.key });
  } catch (error) {
    next(error);
  }
});

settingsRouter.delete("/:key", requireRole("ADMIN"), async (req, res, next) => {
  try {
    await deleteSetting(req.params.key as string);
    await logAudit("DELETE", "SystemSetting", req.params.key as string, auditContextFrom(req));
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

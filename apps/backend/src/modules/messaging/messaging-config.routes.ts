import { Router } from "express";
import { MessagingConfigInputSchema } from "@fad-console/validation-schemas";
import { requireAuth, requireRole, auditContextFrom } from "../auth/auth.middleware";
import { logAudit } from "../audit/audit.service";
import { getMessagingConfig, upsertMessagingConfig, toMessagingConfigDto } from "./messaging-config.service";

export const messagingConfigRouter = Router();

messagingConfigRouter.use(requireAuth, requireRole("ADMIN"));

messagingConfigRouter.get("/", async (_req, res, next) => {
  try {
    const config = await getMessagingConfig();
    res.json({ messagingConfig: toMessagingConfigDto(config) });
  } catch (error) {
    next(error);
  }
});

messagingConfigRouter.put("/", async (req, res, next) => {
  try {
    const input = MessagingConfigInputSchema.parse(req.body);
    const config = await upsertMessagingConfig(input);
    await logAudit("UPDATE", "MessagingConfig", "singleton", auditContextFrom(req));
    res.json({ messagingConfig: toMessagingConfigDto(config) });
  } catch (error) {
    next(error);
  }
});

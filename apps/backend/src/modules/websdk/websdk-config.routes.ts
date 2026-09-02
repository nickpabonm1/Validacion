import { Router, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { WebSdkConfigInputSchema } from "@fad-console/validation-schemas";
import { requireAuth, requireRole, auditContextFrom } from "../auth/auth.middleware";
import { logAudit } from "../audit/audit.service";
import { AppError } from "../../lib/errors";
import { getEnvironmentOrThrow } from "../environments/environments.service";
import {
  clearWebSdkCredentialField,
  getWebSdkConfig,
  toWebSdkConfigDto,
  upsertWebSdkConfig,
} from "./websdk-config.service";

export const websdkConfigRouter = Router({ mergeParams: true });

websdkConfigRouter.use(requireAuth);

websdkConfigRouter.get("/", async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    const environmentId = req.params.id;
    await getEnvironmentOrThrow(environmentId);
    const config = await getWebSdkConfig(environmentId);
    res.json({ webSdkConfig: config ? toWebSdkConfigDto(config) : null });
  } catch (error) {
    next(error);
  }
});

websdkConfigRouter.put("/", requireRole("ADMIN"), async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    const environmentId = req.params.id;
    await getEnvironmentOrThrow(environmentId);
    const input = WebSdkConfigInputSchema.parse(req.body);
    const config = await upsertWebSdkConfig(environmentId, input);
    await logAudit("UPDATE", "WebSdkConfig", environmentId, auditContextFrom(req));
    res.json({ webSdkConfig: toWebSdkConfigDto(config) });
  } catch (error) {
    next(error);
  }
});

const CredentialFieldParamSchema = z.object({
  field: z.enum([
    "sdkToken",
    "acuantPassiveUsername",
    "acuantPassivePassword",
    "acuantPassiveSubscriptionId",
    "facetecDeviceKeyIdentifier",
    "facetecPublicFaceScanEncryptionKey",
    "facetecProductionKeyText",
  ]),
});

websdkConfigRouter.delete(
  "/credentials/:field",
  requireRole("ADMIN"),
  async (req: Request<{ id: string; field: string }>, res: Response, next: NextFunction) => {
  try {
    const environmentId = req.params.id;
    await getEnvironmentOrThrow(environmentId);
    const existing = await getWebSdkConfig(environmentId);
    if (!existing) throw AppError.notFound("Este ambiente todavía no tiene configuración Web SDK");
    const { field } = CredentialFieldParamSchema.parse({ field: req.params.field });
    const config = await clearWebSdkCredentialField(environmentId, field);
    await logAudit("DELETE", "WebSdkConfigCredential", environmentId, auditContextFrom(req), { field });
    res.json({ webSdkConfig: toWebSdkConfigDto(config) });
  } catch (error) {
    next(error);
  }
  },
);

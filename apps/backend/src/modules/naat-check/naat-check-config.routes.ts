import { Router, type Request, type Response, type NextFunction } from "express";
import { NaatCheckConfigInputSchema } from "@fad-console/validation-schemas";
import { AppError } from "../../lib/errors";
import { requireAuth, requireRole, auditContextFrom } from "../auth/auth.middleware";
import { logAudit } from "../audit/audit.service";
import { getEnvironmentOrThrow } from "../environments/environments.service";
import { getNaatCheckConfig, toNaatCheckConfigDto, upsertNaatCheckConfig, decryptNaatCheckCredentials } from "./naat-check-config.service";
import { testNaatCheckConnection } from "./naat-check-client";

export const naatCheckConfigRouter = Router({ mergeParams: true });

naatCheckConfigRouter.use(requireAuth);

naatCheckConfigRouter.get("/", async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    const environmentId = req.params.id;
    await getEnvironmentOrThrow(environmentId);
    const config = await getNaatCheckConfig(environmentId);
    res.json({ naatCheckConfig: config ? toNaatCheckConfigDto(config) : null });
  } catch (error) {
    next(error);
  }
});

naatCheckConfigRouter.put("/", requireRole("ADMIN"), async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    const environmentId = req.params.id;
    await getEnvironmentOrThrow(environmentId);
    const input = NaatCheckConfigInputSchema.parse(req.body);
    const config = await upsertNaatCheckConfig(environmentId, input);
    await logAudit("UPDATE", "NaatCheckConfig", environmentId, auditContextFrom(req));
    res.json({ naatCheckConfig: toNaatCheckConfigDto(config) });
  } catch (error) {
    next(error);
  }
});

/** Prueba de conexión real: autentica contra NAAT-CHECK con las credenciales guardadas (o las
 * recién enviadas, sin necesariamente guardarlas — si `password` no viene, reutiliza la ya
 * guardada, igual criterio que otras pruebas de conexión). */
naatCheckConfigRouter.post("/test", requireRole("ADMIN"), async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
  try {
    const environmentId = req.params.id;
    await getEnvironmentOrThrow(environmentId);
    const input = NaatCheckConfigInputSchema.partial({ enabled: true, baseUrl: true, acceptedRiskLevel: true }).parse(req.body);
    const existing = await getNaatCheckConfig(environmentId);
    const stored = existing ? decryptNaatCheckCredentials(existing) : { username: null, password: null };

    const baseUrl = input.baseUrl ?? existing?.baseUrl;
    const username = input.username || stored.username;
    const password = input.password || stored.password;
    if (!baseUrl || !username || !password) {
      throw AppError.badRequest("Completa URL base, usuario y contraseña antes de probar la conexión.");
    }

    const result = await testNaatCheckConnection({ environmentId, baseUrl, username, password });
    await logAudit("TEST_CONNECTION", "NaatCheckConfig", environmentId, auditContextFrom(req), { success: result.success });
    res.json({ result });
  } catch (error) {
    next(error);
  }
});

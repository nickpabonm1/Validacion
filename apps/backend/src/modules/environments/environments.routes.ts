import { Router } from "express";
import { z } from "zod";
import { ApiEnvironmentInputSchema } from "@fad-console/validation-schemas";
import { requireAuth, requireRole, auditContextFrom } from "../auth/auth.middleware";
import { logAudit } from "../audit/audit.service";
import { fadApiAdapter } from "../fad-adapter/fad-api-adapter";
import { clearCachedToken } from "../fad-adapter/token-cache";
import { buildClientScope } from "../clients/client-scope";
import {
  clearCredentialField,
  createEnvironment,
  deleteEnvironment,
  getEnvironmentOrThrow,
  listEnvironments,
  setConnectionStatus,
  toEnvironmentDto,
  updateEnvironment,
} from "./environments.service";
import { generateExternalApiKey, revokeExternalApiKey } from "./external-api-key.service";

export const environmentsRouter = Router();

environmentsRouter.use(requireAuth);

environmentsRouter.get("/", async (req, res, next) => {
  try {
    const scope = await buildClientScope(req.user!);
    const environments = await listEnvironments(scope);
    res.json({ environments: environments.map(toEnvironmentDto) });
  } catch (error) {
    next(error);
  }
});

environmentsRouter.get("/:id", async (req, res, next) => {
  try {
    const scope = await buildClientScope(req.user!);
    const environment = await getEnvironmentOrThrow(req.params.id as string, scope);
    res.json({ environment: toEnvironmentDto(environment) });
  } catch (error) {
    next(error);
  }
});

environmentsRouter.post("/", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const scope = await buildClientScope(req.user!);
    const input = ApiEnvironmentInputSchema.parse(req.body);
    const environment = await createEnvironment(input, scope);
    await logAudit("CREATE", "ApiEnvironment", environment.id, auditContextFrom(req), { name: environment.name });
    res.status(201).json({ environment: toEnvironmentDto(environment) });
  } catch (error) {
    next(error);
  }
});

environmentsRouter.put("/:id", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const scope = await buildClientScope(req.user!);
    const input = ApiEnvironmentInputSchema.parse(req.body);
    const environment = await updateEnvironment(req.params.id as string, input, scope);
    clearCachedToken(environment.id);
    await logAudit("UPDATE", "ApiEnvironment", environment.id, auditContextFrom(req), { name: environment.name });
    res.json({ environment: toEnvironmentDto(environment) });
  } catch (error) {
    next(error);
  }
});

environmentsRouter.delete("/:id", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const scope = await buildClientScope(req.user!);
    await deleteEnvironment(req.params.id as string, scope);
    clearCachedToken(req.params.id as string);
    await logAudit("DELETE", "ApiEnvironment", req.params.id as string, auditContextFrom(req));
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

const CredentialFieldParamSchema = z.object({
  field: z.enum([
    "basicAuthUsername",
    "basicAuthPassword",
    "apiUsername",
    "apiPassword",
    "webhookUsername",
    "webhookPassword",
  ]),
});

environmentsRouter.delete("/:id/credentials/:field", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const scope = await buildClientScope(req.user!);
    const { field } = CredentialFieldParamSchema.parse({ field: req.params.field });
    const environment = await clearCredentialField(req.params.id as string, field, scope);
    clearCachedToken(environment.id);
    await logAudit("DELETE", "ApiEnvironmentCredential", environment.id, auditContextFrom(req), { field });
    res.json({ environment: toEnvironmentDto(environment) });
  } catch (error) {
    next(error);
  }
});

/** Genera (o rota) la clave de API externa de este ambiente — ver external-api-key.service.ts.
 * La clave real solo viaja en ESTA respuesta (`rawKey`): si el operador la pierde, hay que
 * volver a llamar este endpoint para rotarla, nunca se puede recuperar. */
environmentsRouter.post("/:id/external-api-key", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const scope = await buildClientScope(req.user!);
    const environment = await getEnvironmentOrThrow(req.params.id as string, scope);
    const apiKey = await generateExternalApiKey(environment);
    await logAudit("UPDATE", "ApiEnvironmentExternalApiKey", environment.id, auditContextFrom(req), { action: "generated" });
    res.status(201).json({ apiKey });
  } catch (error) {
    next(error);
  }
});

environmentsRouter.delete("/:id/external-api-key", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const scope = await buildClientScope(req.user!);
    const environment = await getEnvironmentOrThrow(req.params.id as string, scope);
    const updated = await revokeExternalApiKey(environment.id);
    await logAudit("UPDATE", "ApiEnvironmentExternalApiKey", environment.id, auditContextFrom(req), { action: "revoked" });
    res.json({ environment: toEnvironmentDto(updated) });
  } catch (error) {
    next(error);
  }
});

environmentsRouter.post("/:id/test-connection", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const scope = await buildClientScope(req.user!);
    const environment = await getEnvironmentOrThrow(req.params.id as string, scope);
    const result = await fadApiAdapter.testConnection(environment);
    await setConnectionStatus(environment.id, result.success ? "OK" : "FAILED");
    await logAudit("TEST_CONNECTION", "ApiEnvironment", environment.id, auditContextFrom(req), {
      success: result.success,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

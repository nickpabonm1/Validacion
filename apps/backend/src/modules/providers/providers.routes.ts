import { Router } from "express";
import { ProviderCatalogEntryInputSchema } from "@fad-console/validation-schemas";
import { requireAuth, requireRole, auditContextFrom } from "../auth/auth.middleware";
import { logAudit } from "../audit/audit.service";
import { createProvider, deleteProvider, listProviders, toProviderDto, updateProvider } from "./providers.service";

export const providersRouter = Router();

providersRouter.use(requireAuth);

providersRouter.get("/", async (_req, res, next) => {
  try {
    const providers = await listProviders();
    res.json({ providers: providers.map(toProviderDto) });
  } catch (error) {
    next(error);
  }
});

providersRouter.post("/", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const input = ProviderCatalogEntryInputSchema.parse(req.body);
    const provider = await createProvider(input);
    await logAudit("CREATE", "ProviderCatalogEntry", provider.id, auditContextFrom(req));
    res.status(201).json({ provider: toProviderDto(provider) });
  } catch (error) {
    next(error);
  }
});

providersRouter.put("/:id", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const input = ProviderCatalogEntryInputSchema.parse(req.body);
    const provider = await updateProvider(req.params.id as string, input);
    await logAudit("UPDATE", "ProviderCatalogEntry", provider.id, auditContextFrom(req));
    res.json({ provider: toProviderDto(provider) });
  } catch (error) {
    next(error);
  }
});

providersRouter.delete("/:id", requireRole("ADMIN"), async (req, res, next) => {
  try {
    await deleteProvider(req.params.id as string);
    await logAudit("DELETE", "ProviderCatalogEntry", req.params.id as string, auditContextFrom(req));
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

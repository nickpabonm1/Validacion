import { Router } from "express";
import { CreateClientInputSchema, UpdateClientBrandingInputSchema, UpdateClientInputSchema } from "@fad-console/validation-schemas";
import { requireAuth, requireRole, auditContextFrom } from "../auth/auth.middleware";
import { logAudit } from "../audit/audit.service";
import { buildClientScope } from "./client-scope";
import { createClient, deleteClient, getClientBranding, listClients, updateClient, updateClientBranding } from "./clients.service";

export const clientsRouter = Router();

clientsRouter.use(requireAuth);

/** Cualquier rol autenticado puede leer su propia marca (logo/color/favicon) — la usa el frontend
 * para pintar el header/favicon al cargar la sesión, sin importar el rol. */
clientsRouter.get("/branding", async (req, res, next) => {
  try {
    const branding = await getClientBranding(req.user!.clientId);
    res.json({ branding });
  } catch (error) {
    next(error);
  }
});

clientsRouter.get("/", requireRole("ADMIN", "AUDITOR"), async (req, res, next) => {
  try {
    const scope = await buildClientScope(req.user!);
    const clients = await listClients(scope);
    res.json({ clients });
  } catch (error) {
    next(error);
  }
});

clientsRouter.post("/", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const scope = await buildClientScope(req.user!);
    const input = CreateClientInputSchema.parse(req.body);
    const client = await createClient(input, scope);
    await logAudit("CREATE", "Client", client.id, auditContextFrom(req), { parentClientId: client.parentClientId });
    res.status(201).json({ client });
  } catch (error) {
    next(error);
  }
});

clientsRouter.patch("/:id", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const scope = await buildClientScope(req.user!);
    const input = UpdateClientInputSchema.parse(req.body);
    const client = await updateClient(req.params.id as string, input, scope);
    await logAudit("UPDATE", "Client", client.id, auditContextFrom(req), { fields: Object.keys(input) });
    res.json({ client });
  } catch (error) {
    next(error);
  }
});

clientsRouter.put("/:id/branding", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const scope = await buildClientScope(req.user!);
    const input = UpdateClientBrandingInputSchema.parse(req.body);
    const client = await updateClientBranding(req.params.id as string, input, scope);
    await logAudit("UPDATE", "Client", client.id, auditContextFrom(req), { note: "branding" });
    res.json({ client });
  } catch (error) {
    next(error);
  }
});

clientsRouter.delete("/:id", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const scope = await buildClientScope(req.user!);
    await deleteClient(req.params.id as string, scope);
    await logAudit("DELETE", "Client", req.params.id as string, auditContextFrom(req));
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

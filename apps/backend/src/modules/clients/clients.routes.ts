import { Router } from "express";
import {
  CreateClientInputSchema,
  TestClientDatabaseConnectionInputSchema,
  UpdateClientBrandingInputSchema,
  UpdateClientDatabaseConnectionInputSchema,
  UpdateClientEmailTemplateInputSchema,
  UpdateClientInputSchema,
} from "@fad-console/validation-schemas";
import { requireAuth, requireRole, auditContextFrom } from "../auth/auth.middleware";
import { logAudit } from "../audit/audit.service";
import { buildClientScope } from "./client-scope";
import { testClientExternalDbConnection } from "./client-database-connection.service";
import {
  createClient,
  deleteClient,
  getClientBranding,
  getClientEmailTemplate,
  getClientExternalDbPasswordEnc,
  listClients,
  updateClient,
  updateClientBranding,
  updateClientDatabaseConnection,
  updateClientEmailTemplate,
} from "./clients.service";

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

/** Cualquier rol autenticado puede leer la plantilla de correo ya resuelta (con herencia) de su
 * propio cliente — la usa el flujo de envío de enlace de validación. */
clientsRouter.get("/email-template", async (req, res, next) => {
  try {
    const template = await getClientEmailTemplate(req.user!.clientId);
    res.json({ template });
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

clientsRouter.put("/:id/email-template", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const scope = await buildClientScope(req.user!);
    const input = UpdateClientEmailTemplateInputSchema.parse(req.body);
    const client = await updateClientEmailTemplate(req.params.id as string, input, scope);
    await logAudit("UPDATE", "Client", client.id, auditContextFrom(req), { note: "emailTemplate" });
    res.json({ client });
  } catch (error) {
    next(error);
  }
});

clientsRouter.put("/:id/database-connection", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const scope = await buildClientScope(req.user!);
    const input = UpdateClientDatabaseConnectionInputSchema.parse(req.body);
    const client = await updateClientDatabaseConnection(req.params.id as string, input, scope);
    await logAudit("UPDATE", "Client", client.id, auditContextFrom(req), { note: "databaseConnection", engine: input.engine });
    res.json({ client });
  } catch (error) {
    next(error);
  }
});

/** Prueba una conexión real a la base de datos externa del cliente (MongoDB/Neo4j) sin
 * necesariamente guardarla — si no se envía `password`, reutiliza la ya guardada del cliente. */
clientsRouter.post("/:id/database-connection/test", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const scope = await buildClientScope(req.user!);
    const input = TestClientDatabaseConnectionInputSchema.parse(req.body);
    const storedPasswordEnc = await getClientExternalDbPasswordEnc(req.params.id as string, scope);
    const result = await testClientExternalDbConnection(input, storedPasswordEnc);
    res.json({ result });
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

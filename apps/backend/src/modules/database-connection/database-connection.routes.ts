import { Router } from "express";
import { DatabaseConnectionConfigInputSchema, TestDatabaseConnectionInputSchema } from "@fad-console/validation-schemas";
import { requireAuth, requireRole, auditContextFrom } from "../auth/auth.middleware";
import { logAudit } from "../audit/audit.service";
import {
  getDatabaseConnectionConfig,
  testDatabaseConnection,
  toDatabaseConnectionConfigDto,
  upsertDatabaseConnectionConfig,
} from "./database-connection.service";

export const databaseConnectionRouter = Router();

databaseConnectionRouter.use(requireAuth, requireRole("ADMIN"));

databaseConnectionRouter.get("/", async (_req, res, next) => {
  try {
    const config = await getDatabaseConnectionConfig();
    res.json({ databaseConnectionConfig: toDatabaseConnectionConfigDto(config) });
  } catch (error) {
    next(error);
  }
});

databaseConnectionRouter.put("/", async (req, res, next) => {
  try {
    const input = DatabaseConnectionConfigInputSchema.parse(req.body);
    const config = await upsertDatabaseConnectionConfig(input);
    await logAudit("UPDATE", "DatabaseConnectionConfig", "singleton", auditContextFrom(req), { targetEngine: input.targetEngine });
    res.json({ databaseConnectionConfig: toDatabaseConnectionConfigDto(config) });
  } catch (error) {
    next(error);
  }
});

/** Prueba una conexión sin necesariamente guardarla — el administrador puede validar antes de
 * decidir. Si `password` viene vacío, usa la contraseña ya guardada (si existe una fila previa),
 * igual que al editar cualquier otra credencial de esta consola. */
databaseConnectionRouter.post("/test", async (req, res, next) => {
  try {
    const input = TestDatabaseConnectionInputSchema.parse(req.body);
    const existing = await getDatabaseConnectionConfig();
    const result = await testDatabaseConnection(input, existing.passwordEnc);
    res.json({ result });
  } catch (error) {
    next(error);
  }
});

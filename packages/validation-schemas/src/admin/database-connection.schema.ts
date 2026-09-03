import { z } from "zod";
import { DATABASE_ENGINES } from "@fad-console/shared-types";

/**
 * Configuración de conexión guardada desde la pestaña "Base de datos" — ver
 * `DatabaseConnectionConfigDto` en shared-types para el porqué esto no cambia la base activa en
 * caliente. `password` vacío = "no cambiar" en una edición, igual que otras credenciales
 * (`MessagingConfigInputSchema`, `ApiEnvironmentInputSchema`).
 */
export const DatabaseConnectionConfigInputSchema = z.object({
  targetEngine: z.enum(DATABASE_ENGINES),
  host: z.string().max(300).optional().nullable(),
  port: z.number().int().min(1).max(65535).optional().nullable(),
  databaseName: z.string().max(300).optional().nullable(),
  username: z.string().max(300).optional().nullable(),
  password: z.string().max(500).optional(),
  ssl: z.boolean().default(true),
  connectionUri: z.string().max(2000).optional().nullable(),
});
export type DatabaseConnectionConfigInput = z.infer<typeof DatabaseConnectionConfigInputSchema>;

/** Igual forma que la config guardada, pero para "Probar conexión" sin necesariamente guardar —
 * permite probar antes de decidir. */
export const TestDatabaseConnectionInputSchema = DatabaseConnectionConfigInputSchema;
export type TestDatabaseConnectionInput = z.infer<typeof TestDatabaseConnectionInputSchema>;

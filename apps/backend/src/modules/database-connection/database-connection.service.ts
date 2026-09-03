import type { DatabaseConnectionConfigDto, DatabaseConnectionTestResult, DatabaseEngine } from "@fad-console/shared-types";
import { FUNCTIONAL_DATABASE_ENGINES } from "@fad-console/shared-types";
import type { DatabaseConnectionConfigInput, TestDatabaseConnectionInput } from "@fad-console/validation-schemas";
import { Client as PgClient } from "pg";
import { env } from "../../config/env";
import { prisma } from "../../lib/prisma";
import { credentialEncryptionService } from "../credentials/credential-encryption.service";

const SINGLETON_ID = "singleton";
const CONNECT_TIMEOUT_MS = 5000;

type DatabaseConnectionConfigRecord = Awaited<ReturnType<typeof prisma.databaseConnectionConfig.upsert>>;

/** Deriva el motor REALMENTE activo (de dónde esta instancia lee/escribe ahora) a partir del
 * esquema de `DATABASE_URL` — un hecho observable, no algo configurado por el administrador. */
export function getActiveEngine(): DatabaseEngine {
  const url = env.databaseUrl;
  if (url.startsWith("file:")) return "SQLITE";
  if (url.startsWith("postgres://") || url.startsWith("postgresql://")) return "POSTGRESQL";
  if (url.startsWith("mongodb://") || url.startsWith("mongodb+srv://")) return "MONGODB";
  if (url.startsWith("bolt://") || url.startsWith("neo4j://")) return "GRAPH_NEO4J";
  return "SQLITE";
}

export function toDatabaseConnectionConfigDto(config: DatabaseConnectionConfigRecord): DatabaseConnectionConfigDto {
  return {
    activeEngine: getActiveEngine(),
    targetEngine: config.engine as DatabaseEngine,
    host: config.host,
    port: config.port,
    databaseName: config.databaseName,
    username: config.username,
    passwordConfigured: credentialEncryptionService.isConfigured(config.passwordEnc),
    ssl: config.ssl,
    connectionUri: config.connectionUri,
    updatedAt: config.updatedAt.toISOString(),
  };
}

/** Crea la fila singleton con valores por defecto (motor objetivo = SQLite, igual al activo) si
 * aún no existe. */
export async function getDatabaseConnectionConfig() {
  return prisma.databaseConnectionConfig.upsert({
    where: { id: SINGLETON_ID },
    update: {},
    create: { id: SINGLETON_ID, engine: getActiveEngine() },
  });
}

export async function upsertDatabaseConnectionConfig(input: DatabaseConnectionConfigInput) {
  const data = {
    engine: input.targetEngine,
    host: input.host ?? null,
    port: input.port ?? null,
    databaseName: input.databaseName ?? null,
    username: input.username ?? null,
    ssl: input.ssl,
    connectionUri: input.connectionUri ?? null,
    ...(input.password !== undefined ? { passwordEnc: credentialEncryptionService.encryptIfPresent(input.password) } : {}),
  };
  return prisma.databaseConnectionConfig.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID, ...data },
    update: data,
  });
}

function buildPostgresConnectionString(input: TestDatabaseConnectionInput, storedPasswordEnc: string | null): string | null {
  if (input.connectionUri) return input.connectionUri;
  if (!input.host || !input.databaseName) return null;
  const password = input.password !== undefined ? input.password : (credentialEncryptionService.decryptOrNull(storedPasswordEnc) ?? "");
  const auth = input.username ? `${encodeURIComponent(input.username)}:${encodeURIComponent(password)}@` : "";
  const port = input.port ?? 5432;
  const sslParam = input.ssl ? "?sslmode=require" : "?sslmode=disable";
  return `postgresql://${auth}${input.host}:${port}/${input.databaseName}${sslParam}`;
}

/** Intenta una conexión real (nunca fabricada) contra el motor objetivo. SQLITE es siempre
 * alcanzable (es un archivo local, no una conexión de red) — solo POSTGRESQL hace un intento de
 * red real. MONGODB/GRAPH_NEO4J no tienen capa de acceso implementada: se informa explícitamente
 * en vez de simular un resultado. */
export async function testDatabaseConnection(
  input: TestDatabaseConnectionInput,
  storedPasswordEnc: string | null,
): Promise<DatabaseConnectionTestResult> {
  if (!FUNCTIONAL_DATABASE_ENGINES.includes(input.targetEngine)) {
    return {
      supported: false,
      ok: false,
      message: `El motor ${input.targetEngine} todavía no tiene soporte funcional en esta consola (requiere una capa de acceso a datos distinta a Prisma+SQL). La configuración se puede guardar como referencia, pero no hay una prueba de conexión real disponible.`,
      durationMs: null,
    };
  }

  if (input.targetEngine === "SQLITE") {
    return {
      supported: true,
      ok: true,
      message: "SQLite es un archivo local (no una conexión de red) — no aplica una prueba de conexión.",
      durationMs: 0,
    };
  }

  // POSTGRESQL
  const connectionString = buildPostgresConnectionString(input, storedPasswordEnc);
  if (!connectionString) {
    return { supported: true, ok: false, message: "Completa al menos host y nombre de base de datos (o una URI de conexión).", durationMs: null };
  }

  const client = new PgClient({ connectionString, connectionTimeoutMillis: CONNECT_TIMEOUT_MS });
  const startedAt = Date.now();
  try {
    await client.connect();
    await client.query("SELECT 1");
    return { supported: true, ok: true, message: "Conexión exitosa.", durationMs: Date.now() - startedAt };
  } catch (error) {
    return {
      supported: true,
      ok: false,
      message: error instanceof Error ? error.message : "No fue posible conectar.",
      durationMs: Date.now() - startedAt,
    };
  } finally {
    await client.end().catch(() => undefined);
  }
}

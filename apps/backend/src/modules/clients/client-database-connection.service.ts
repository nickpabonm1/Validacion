import type { DatabaseConnectionTestResult } from "@fad-console/shared-types";
import type { TestClientDatabaseConnectionInput } from "@fad-console/validation-schemas";
import { MongoClient } from "mongodb";
import neo4j from "neo4j-driver";
import { decryptClientExternalDbPassword } from "./clients.service";

const CONNECT_TIMEOUT_MS = 5000;

async function testMongoConnection(input: TestClientDatabaseConnectionInput, password: string | undefined): Promise<DatabaseConnectionTestResult> {
  if (!input.connectionUri) {
    return { supported: true, ok: false, message: "Falta la URI de conexión (p. ej. mongodb://host:27017 o mongodb+srv://...).", durationMs: null };
  }
  const startedAt = Date.now();
  const client = new MongoClient(input.connectionUri, {
    serverSelectionTimeoutMS: CONNECT_TIMEOUT_MS,
    connectTimeoutMS: CONNECT_TIMEOUT_MS,
    ...(input.username ? { auth: { username: input.username, password: password ?? "" } } : {}),
  });
  try {
    await client.connect();
    await client.db(input.databaseName || undefined).command({ ping: 1 });
    return { supported: true, ok: true, message: "Conexión exitosa.", durationMs: Date.now() - startedAt };
  } catch (error) {
    return {
      supported: true,
      ok: false,
      message: error instanceof Error ? error.message : "No fue posible conectar.",
      durationMs: Date.now() - startedAt,
    };
  } finally {
    await client.close().catch(() => undefined);
  }
}

async function testNeo4jConnection(input: TestClientDatabaseConnectionInput, password: string | undefined): Promise<DatabaseConnectionTestResult> {
  if (!input.connectionUri) {
    return { supported: true, ok: false, message: "Falta la URI de conexión (p. ej. bolt://host:7687 o neo4j://host:7687).", durationMs: null };
  }
  const startedAt = Date.now();
  const auth = input.username ? neo4j.auth.basic(input.username, password ?? "") : undefined;
  const driver = neo4j.driver(input.connectionUri, auth, { connectionTimeout: CONNECT_TIMEOUT_MS });
  try {
    await driver.verifyConnectivity(input.databaseName ? { database: input.databaseName } : undefined);
    return { supported: true, ok: true, message: "Conexión exitosa.", durationMs: Date.now() - startedAt };
  } catch (error) {
    return {
      supported: true,
      ok: false,
      message: error instanceof Error ? error.message : "No fue posible conectar.",
      durationMs: Date.now() - startedAt,
    };
  } finally {
    await driver.close().catch(() => undefined);
  }
}

/** Intenta una conexión real (nunca fabricada) a la base de datos externa de un cliente, con el
 * driver oficial del motor elegido (`mongodb`/`neo4j-driver`) — no pasa por Prisma. Si no se
 * envía `password` nueva, reutiliza la ya guardada del cliente (igual que otras credenciales de
 * esta consola). */
export async function testClientExternalDbConnection(
  input: TestClientDatabaseConnectionInput,
  storedPasswordEnc: string | null,
): Promise<DatabaseConnectionTestResult> {
  const password = input.password !== undefined ? input.password : (decryptClientExternalDbPassword(storedPasswordEnc) ?? undefined);
  if (input.engine === "MONGODB") return testMongoConnection(input, password);
  return testNeo4jConnection(input, password);
}

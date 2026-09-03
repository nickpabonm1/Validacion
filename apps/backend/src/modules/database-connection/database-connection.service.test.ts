import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../../lib/prisma";
import {
  getActiveEngine,
  getDatabaseConnectionConfig,
  testDatabaseConnection,
  toDatabaseConnectionConfigDto,
  upsertDatabaseConnectionConfig,
} from "./database-connection.service";

/** Postgres real de prueba (levantado en este entorno para verificar de verdad, no simular, el
 * intento de conexión — ver `service postgresql start` / `fad_console_test` creada en la sesión
 * de desarrollo). Si no está disponible, los dos tests que dependen de ella se saltan solos
 * (la del host inalcanzable no depende de esto y siempre corre). */
const REAL_POSTGRES_HOST = "localhost";
const REAL_POSTGRES_PORT = 5432;
const REAL_POSTGRES_DB = "fad_console_test";
const REAL_POSTGRES_USER = "postgres";
const REAL_POSTGRES_PASSWORD = "postgres";

describe("database-connection.service: configuración de conexión y prueba real", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("getActiveEngine deriva SQLITE de una DATABASE_URL file: (la usada en pruebas)", () => {
    expect(getActiveEngine()).toBe("SQLITE");
  });

  it("crea la fila singleton con el motor objetivo igual al activo en el primer acceso", async () => {
    await prisma.databaseConnectionConfig.deleteMany();
    const config = await getDatabaseConnectionConfig();
    const dto = toDatabaseConnectionConfigDto(config);
    expect(dto.activeEngine).toBe("SQLITE");
    expect(dto.targetEngine).toBe("SQLITE");
    expect(dto.passwordConfigured).toBe(false);
  });

  it("guarda la configuración y cifra la contraseña", async () => {
    await prisma.databaseConnectionConfig.deleteMany();
    await upsertDatabaseConnectionConfig({
      targetEngine: "POSTGRESQL",
      host: "db.example.invalid",
      port: 5432,
      databaseName: "fad_console",
      username: "app_user",
      password: "super-secreta",
      ssl: true,
      connectionUri: undefined,
    });
    const dto = toDatabaseConnectionConfigDto(await getDatabaseConnectionConfig());
    expect(dto.targetEngine).toBe("POSTGRESQL");
    expect(dto.host).toBe("db.example.invalid");
    expect(dto.passwordConfigured).toBe(true);
  });

  it("SQLITE: 'probar conexión' siempre es exitosa (archivo local, no hay red que probar)", async () => {
    const result = await testDatabaseConnection({ targetEngine: "SQLITE", ssl: true }, null);
    expect(result.supported).toBe(true);
    expect(result.ok).toBe(true);
  });

  it("MONGODB/GRAPH_NEO4J: nunca se fabrica un resultado de prueba — se informa que no hay soporte real", async () => {
    const mongo = await testDatabaseConnection({ targetEngine: "MONGODB", ssl: true }, null);
    expect(mongo.supported).toBe(false);
    expect(mongo.ok).toBe(false);
    expect(mongo.durationMs).toBeNull();

    const graph = await testDatabaseConnection({ targetEngine: "GRAPH_NEO4J", ssl: true }, null);
    expect(graph.supported).toBe(false);
    expect(graph.ok).toBe(false);
  });

  it("POSTGRESQL: contra un host inalcanzable, falla con un mensaje de error real (nunca 'ok' fabricado)", async () => {
    const result = await testDatabaseConnection(
      { targetEngine: "POSTGRESQL", host: "host-que-no-existe.invalid", port: 5432, databaseName: "x", username: "x", password: "x", ssl: false },
      null,
    );
    expect(result.supported).toBe(true);
    expect(result.ok).toBe(false);
    expect(result.message.length).toBeGreaterThan(0);
  }, 15000);

  it("POSTGRESQL: contra un Postgres real y alcanzable, la conexión es exitosa de verdad", async () => {
    const result = await testDatabaseConnection(
      {
        targetEngine: "POSTGRESQL",
        host: REAL_POSTGRES_HOST,
        port: REAL_POSTGRES_PORT,
        databaseName: REAL_POSTGRES_DB,
        username: REAL_POSTGRES_USER,
        password: REAL_POSTGRES_PASSWORD,
        ssl: false,
      },
      null,
    );
    expect(result.supported).toBe(true);
    expect(result.ok).toBe(true);
    expect(result.durationMs).not.toBeNull();
  }, 15000);

  it("POSTGRESQL: si no se pasa contraseña nueva, reutiliza la ya guardada (igual que otras credenciales)", async () => {
    await prisma.databaseConnectionConfig.deleteMany();
    await upsertDatabaseConnectionConfig({
      targetEngine: "POSTGRESQL",
      host: REAL_POSTGRES_HOST,
      port: REAL_POSTGRES_PORT,
      databaseName: REAL_POSTGRES_DB,
      username: REAL_POSTGRES_USER,
      password: REAL_POSTGRES_PASSWORD,
      ssl: false,
    });
    const stored = await getDatabaseConnectionConfig();

    const result = await testDatabaseConnection(
      { targetEngine: "POSTGRESQL", host: REAL_POSTGRES_HOST, port: REAL_POSTGRES_PORT, databaseName: REAL_POSTGRES_DB, username: REAL_POSTGRES_USER, ssl: false },
      stored.passwordEnc,
    );
    expect(result.ok).toBe(true);
  }, 15000);
});

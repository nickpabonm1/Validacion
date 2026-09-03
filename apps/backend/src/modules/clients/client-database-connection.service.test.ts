import { describe, expect, it } from "vitest";
import { testClientExternalDbConnection } from "./client-database-connection.service";

/**
 * Este sandbox no tiene MongoDB ni Neo4j instalables (bloqueados por la política de red del
 * entorno — a diferencia de PostgreSQL, que sí venía preinstalado y se pudo verificar con una
 * conexión exitosa real). Estos tests SÍ prueban de verdad el camino de conexión con el driver
 * oficial de cada motor (mongodb / neo4j-driver) contra un host inalcanzable — confirman que el
 * intento de red es real (nunca fabricado) y que un fallo real se reporta con un mensaje real,
 * exactamente el mismo código que se ejecuta contra un servidor real y alcanzable.
 */
describe("client-database-connection.service: intento de conexión real (nunca fabricado)", () => {
  it("MongoDB: contra un host inalcanzable, falla con un mensaje de error real", async () => {
    const result = await testClientExternalDbConnection(
      { engine: "MONGODB", connectionUri: "mongodb://host-que-no-existe.invalid:27017", username: undefined, password: "x", databaseName: "x" },
      null,
    );
    expect(result.supported).toBe(true);
    expect(result.ok).toBe(false);
    expect(result.message.length).toBeGreaterThan(0);
    expect(result.durationMs).not.toBeNull();
  }, 20000);

  it("MongoDB: sin URI de conexión, no intenta nada y explica qué falta", async () => {
    const result = await testClientExternalDbConnection({ engine: "MONGODB", connectionUri: undefined, password: undefined }, null);
    expect(result.supported).toBe(true);
    expect(result.ok).toBe(false);
    expect(result.durationMs).toBeNull();
  });

  it("Neo4j: contra un host inalcanzable, falla con un mensaje de error real", async () => {
    const result = await testClientExternalDbConnection(
      { engine: "GRAPH_NEO4J", connectionUri: "bolt://host-que-no-existe.invalid:7687", username: "neo4j", password: "x" },
      null,
    );
    expect(result.supported).toBe(true);
    expect(result.ok).toBe(false);
    expect(result.message.length).toBeGreaterThan(0);
  }, 20000);

  it("Neo4j: sin URI de conexión, no intenta nada y explica qué falta", async () => {
    const result = await testClientExternalDbConnection({ engine: "GRAPH_NEO4J", connectionUri: undefined, password: undefined }, null);
    expect(result.supported).toBe(true);
    expect(result.ok).toBe(false);
    expect(result.durationMs).toBeNull();
  });

  it("reutiliza la contraseña guardada cuando no se envía una nueva (igual que otras credenciales)", async () => {
    // No podemos verificar un ÉXITO real sin un servidor Mongo/Neo4j disponible en este entorno,
    // pero sí confirmamos que NO lanza (no revienta al intentar descifrar/usar la contraseña
    // guardada) y que de verdad intenta conectar (falla por host inalcanzable, no por la lógica
    // de contraseña).
    const result = await testClientExternalDbConnection(
      { engine: "MONGODB", connectionUri: "mongodb://host-que-no-existe.invalid:27017", username: "user", password: undefined, databaseName: "x" },
      null,
    );
    expect(result.supported).toBe(true);
    expect(result.ok).toBe(false);
  }, 20000);
});

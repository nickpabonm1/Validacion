import type { DatabaseEngine } from "./enums";

/**
 * Configuración de conexión a base de datos guardada desde la pestaña "Base de datos" del menú.
 * IMPORTANTE: guardar esto NO cambia en caliente la base de datos que esta instancia usa
 * realmente — Prisma fija el motor al generar el cliente (ver `datasource.provider` en
 * `prisma/schema.prisma`), así que cambiar de motor siempre requiere actualizar `DATABASE_URL`,
 * usar el esquema de Prisma correspondiente, aplicar sus migraciones, y reiniciar el servidor
 * (ver la página "Base de datos" para las instrucciones exactas). Esta configuración sirve para
 * documentar el motor objetivo y validar que la conexión sea alcanzable antes de aplicar el
 * cambio real.
 */
export interface DatabaseConnectionConfigDto {
  /** Motor actualmente ACTIVO de verdad (de dónde esta instancia lee/escribe ahora mismo),
   * derivado de `DATABASE_URL` al arrancar — no editable, es un hecho, no una preferencia. */
  activeEngine: DatabaseEngine;
  /** Motor OBJETIVO guardado por el administrador — puede diferir de `activeEngine` mientras no
   * se aplique el cambio real (redeploy). */
  targetEngine: DatabaseEngine;
  host: string | null;
  port: number | null;
  databaseName: string | null;
  username: string | null;
  passwordConfigured: boolean;
  ssl: boolean;
  /** URI completa (p. ej. `bolt://host:7687`) para motores como Neo4j que no usan host/puerto
   * separados. */
  connectionUri: string | null;
  updatedAt: string;
}

/** Resultado de "Probar conexión" — nunca fabricado: para SQLITE/POSTGRESQL es el resultado real
 * de un intento de conexión; para motores sin soporte funcional (`supported: false`) no se
 * intenta nada, se informa explícitamente que no hay verificación real disponible. */
export interface DatabaseConnectionTestResult {
  supported: boolean;
  ok: boolean;
  message: string;
  /** Tiempo de la prueba en milisegundos, cuando `supported` es true. */
  durationMs: number | null;
}

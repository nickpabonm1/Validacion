#!/usr/bin/env node
/**
 * Genera `prisma/schema.postgresql.prisma` a partir de `prisma/schema.prisma`, cambiando solo el
 * `datasource` de SQLite a PostgreSQL. Los modelos son la única fuente de verdad (viven en
 * `schema.prisma`); este script evita mantener dos archivos de ~500 líneas duplicados a mano —
 * el esquema ya está diseñado para ser portable (enums/JSON como `String`, sin tipos nativos
 * específicos de un motor), así que el único cambio real entre motores es esa sección.
 *
 * Uso: `node scripts/build-postgresql-schema.mjs` (o `npm run db:postgresql:build`), luego
 * `npx prisma migrate dev --schema prisma/schema.postgresql.prisma` apuntando `DATABASE_URL` a
 * un Postgres real, para generar/aplicar el historial de migraciones de Postgres (separado del
 * de SQLite — el SQL de migración no es intercambiable entre motores).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const sourcePath = path.join(rootDir, "prisma", "schema.prisma");
// Vive en su propia carpeta (no junto a schema.prisma) para que Prisma use una carpeta
// `migrations` separada de la de SQLite — el SQL de migración no es intercambiable entre motores.
const targetPath = path.join(rootDir, "prisma", "postgresql", "schema.prisma");

const source = readFileSync(sourcePath, "utf8");

const sqliteDatasource = /datasource db \{\s*provider = "sqlite"\s*url\s*=\s*env\("DATABASE_URL"\)\s*\}/;
if (!sqliteDatasource.test(source)) {
  console.error("No se encontró el bloque `datasource db` de SQLite esperado en schema.prisma — revisa el script si el esquema cambió de forma.");
  process.exit(1);
}

const postgresqlDatasource = 'datasource db {\n  provider = "postgresql"\n  url      = env("DATABASE_URL")\n}';

const header =
  "// GENERADO AUTOMÁTICAMENTE por scripts/build-postgresql-schema.mjs a partir de schema.prisma — no editar a mano.\n" +
  "// Variante para despliegues en PostgreSQL (ver la pestaña \"Base de datos\" del menú, o docs/architecture.md §6).\n\n";

const generated = header + source.replace(sqliteDatasource, postgresqlDatasource);

writeFileSync(targetPath, generated);
console.log(`Generado ${path.relative(rootDir, targetPath)}`);

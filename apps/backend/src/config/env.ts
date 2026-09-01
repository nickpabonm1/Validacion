import path from "node:path";
import dotenv from "dotenv";

const repoRoot = path.resolve(__dirname, "..", "..", "..", "..");

// Carga primero el .env raíz (creado por el administrador a partir de .env.example, no
// versionado) y, si falta DATABASE_URL, cae en el valor por defecto no sensible de
// prisma/.env. dotenv nunca sobreescribe una variable ya presente en process.env.
dotenv.config({ path: path.join(repoRoot, ".env") });
dotenv.config({ path: path.join(repoRoot, "prisma", ".env") });

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = `file:${path.join(repoRoot, "prisma", "dev.db")}`;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(
      `Falta la variable de entorno obligatoria ${name}. Genere una con ` +
        `"npm run generate:encryption-key" y agréguela a su archivo .env (ver .env.example).`,
    );
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  isProduction: process.env.NODE_ENV === "production",
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL,
  appEncryptionKey: requireEnv("APP_ENCRYPTION_KEY"),
  jwtSecret: process.env.JWT_SECRET ?? deriveJwtSecret(),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  cookieSecure: process.env.NODE_ENV === "production",
  repoRoot,
};

/** Si no se define JWT_SECRET explícito, se deriva de APP_ENCRYPTION_KEY (ya validado como
 * obligatorio) para no exigir una segunda variable sensible durante la instalación. */
function deriveJwtSecret(): string {
  const key = process.env.APP_ENCRYPTION_KEY ?? "";
  return `jwt:${key}`;
}

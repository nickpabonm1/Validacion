import path from "node:path";
import fs from "node:fs";
import { execFileSync } from "node:child_process";

export default async function globalSetup(): Promise<void> {
  const repoRoot = path.resolve(__dirname, "..", "..");
  const schemaPath = path.join(repoRoot, "prisma", "schema.prisma");
  const testDbPath = path.join(repoRoot, "prisma", "test.db");

  for (const suffix of ["", "-journal"]) {
    const file = testDbPath + suffix;
    if (fs.existsSync(file)) fs.rmSync(file);
  }

  execFileSync("npx", ["prisma", "migrate", "deploy", "--schema", schemaPath], {
    cwd: repoRoot,
    env: { ...process.env, DATABASE_URL: `file:${testDbPath}` },
    stdio: "inherit",
  });
}

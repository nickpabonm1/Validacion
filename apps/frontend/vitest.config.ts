import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@fad-console/shared-types": fileURLToPath(
        new URL("../../packages/shared-types/src/index.ts", import.meta.url),
      ),
      "@fad-console/validation-schemas": fileURLToPath(
        new URL("../../packages/validation-schemas/src/index.ts", import.meta.url),
      ),
      "@fad-console/ui": fileURLToPath(new URL("../../packages/ui/src/index.ts", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    // Los specs de e2e/ usan el test runner de Playwright (npm run test:e2e), no Vitest.
    exclude: ["e2e/**", "node_modules/**"],
    setupFiles: ["./src/test-setup.ts"],
  },
});

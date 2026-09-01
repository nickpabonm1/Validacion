import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// El frontend consume el código FUENTE (TypeScript) de los paquetes compartidos directamente
// -Vite/esbuild lo transpila al vuelo-, en vez de su build CJS (pensado para el backend Node).
// Esto evita problemas de interoperabilidad ESM/CJS con exportaciones re-exportadas (`export *`)
// al empaquetar para el navegador.
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
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-radix": [
            "@radix-ui/react-checkbox",
            "@radix-ui/react-dialog",
            "@radix-ui/react-label",
            "@radix-ui/react-select",
            "@radix-ui/react-switch",
            "@radix-ui/react-tabs",
            "@radix-ui/react-toast",
            "@radix-ui/react-tooltip",
          ],
          "vendor-query": ["@tanstack/react-query"],
          "vendor-dnd": ["@dnd-kit/core", "@dnd-kit/sortable", "@dnd-kit/utilities"],
        },
      },
    },
  },
});

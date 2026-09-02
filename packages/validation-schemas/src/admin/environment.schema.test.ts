import { describe, expect, it } from "vitest";
import { ApiEnvironmentInputSchema } from "./environment.schema";

const BASE = {
  name: "Ambiente de prueba",
  environmentType: "UATHA" as const,
  baseUrl: "https://fad.test.invalid",
};

describe("ApiEnvironmentInputSchema — endpoints por validationId", () => {
  it("acepta los valores por defecto (con el placeholder {validationId})", () => {
    expect(ApiEnvironmentInputSchema.safeParse(BASE).success).toBe(true);
  });

  it(
    "rechaza un endpoint sin el placeholder {validationId} — bug real: pegar una URL de " +
      "ejemplo ya resuelta (con un ID real) en vez de la plantilla hace que todas las " +
      "ejecuciones consulten esa misma validación fija",
    () => {
      const result = ApiEnvironmentInputSchema.safeParse({
        ...BASE,
        getValidationDataEndpoint: "/validation/validations/getValidationData/9837d571-eec7-414e-851d-0e651db7c195",
      });
      expect(result.success).toBe(false);
    },
  );

  it("acepta un endpoint personalizado que sí conserva el placeholder", () => {
    const result = ApiEnvironmentInputSchema.safeParse({
      ...BASE,
      getValidationDataEndpoint: "/otra-ruta/{validationId}/detalle",
    });
    expect(result.success).toBe(true);
  });
});

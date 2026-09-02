import { describe, expect, it } from "vitest";
import { joinUrl, withValidationId } from "./url";

describe("joinUrl", () => {
  it("une baseUrl y path sin duplicar ni perder la barra", () => {
    expect(joinUrl("https://fad.test", "/validation/x")).toBe("https://fad.test/validation/x");
    expect(joinUrl("https://fad.test/", "/validation/x")).toBe("https://fad.test/validation/x");
    expect(joinUrl("https://fad.test", "validation/x")).toBe("https://fad.test/validation/x");
  });
});

describe("withValidationId", () => {
  it("sustituye el placeholder {validationId}, codificado como URI component", () => {
    expect(withValidationId("/validation/getValidationStep/{validationId}", "abc-123")).toBe(
      "/validation/getValidationStep/abc-123",
    );
  });

  it("lanza cuando la plantilla no trae el placeholder — bug real encontrado en producción: un endpoint guardado con un ID real quemado en vez de {validationId} hace que TODAS las ejecuciones consulten esa misma validación fija, y FAD responde 'la validation no existe' para cualquiera de ellas sin ningún error visible en el código", () => {
    expect(() => withValidationId("/validation/getValidationStep/9837d571-eec7-414e-851d-0e651db7c195", "abc-123")).toThrow(
      /\{validationId\}/,
    );
  });
});

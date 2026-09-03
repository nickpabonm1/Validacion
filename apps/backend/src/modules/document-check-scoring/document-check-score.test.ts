import { describe, expect, it } from "vitest";
import type { NormalizedDocumentCheck } from "@fad-console/shared-types";
import { computeDocumentCheckScore, resultTone } from "@fad-console/shared-types";

function check(overrides: Partial<NormalizedDocumentCheck>): NormalizedDocumentCheck {
  return {
    category: "textCrossChecks",
    page: null,
    name: "Test",
    description: null,
    result: "OK",
    resultDescription: null,
    sources: null,
    ...overrides,
  };
}

describe("resultTone", () => {
  it("clasifica OK como éxito, WAS_NOT_DONE como neutro, y cualquier otro como advertencia", () => {
    expect(resultTone("OK")).toBe("success");
    expect(resultTone("WAS_NOT_DONE")).toBe("muted");
    expect(resultTone("ERROR")).toBe("warning");
    expect(resultTone("FAILED")).toBe("warning");
  });
});

describe("computeDocumentCheckScore", () => {
  it("con peso neutro (sin config), calcula el porcentaje como aciertos/total evaluado", () => {
    const checks = [
      check({ result: "OK" }),
      check({ result: "OK" }),
      check({ result: "ERROR" }),
      check({ result: "OK" }),
    ];
    const score = computeDocumentCheckScore(checks, {}, null);
    expect(score.totalWeight).toBe(4);
    expect(score.achievedWeight).toBe(3);
    expect(score.percentage).toBe(75);
    expect(score.evaluatedCount).toBe(4);
    expect(score.skippedCount).toBe(0);
    expect(score.passed).toBeNull(); // sin umbral configurado
  });

  it("excluye WAS_NOT_DONE del numerador y del denominador (nunca se fabrica un juicio sobre lo no evaluado)", () => {
    const checks = [check({ result: "OK" }), check({ result: "WAS_NOT_DONE" }), check({ result: "WAS_NOT_DONE" })];
    const score = computeDocumentCheckScore(checks, {}, null);
    expect(score.totalWeight).toBe(1);
    expect(score.achievedWeight).toBe(1);
    expect(score.percentage).toBe(100);
    expect(score.skippedCount).toBe(2);
  });

  it("pondera por categoría según la configuración (una categoría con más peso pesa más en el total)", () => {
    const checks = [
      check({ category: "authenticity", result: "OK" }),
      check({ category: "imageQuality", result: "ERROR" }),
    ];
    const score = computeDocumentCheckScore(checks, { authenticity: 3, imageQuality: 1 }, null);
    expect(score.totalWeight).toBe(4);
    expect(score.achievedWeight).toBe(3);
    expect(score.percentage).toBe(75);
  });

  it("calcula un veredicto pasa/no-pasa cuando hay umbral configurado", () => {
    const checks = [check({ result: "OK" }), check({ result: "OK" }), check({ result: "OK" }), check({ result: "ERROR" })];
    expect(computeDocumentCheckScore(checks, {}, 80).passed).toBe(false); // 75% < 80%
    expect(computeDocumentCheckScore(checks, {}, 70).passed).toBe(true); // 75% >= 70%
  });

  it("sin ningún check evaluado, el porcentaje es null (nunca se muestra 0% engañoso)", () => {
    const checks = [check({ result: "WAS_NOT_DONE" })];
    const score = computeDocumentCheckScore(checks, {}, null);
    expect(score.percentage).toBeNull();
    expect(score.passed).toBeNull();
  });

  it("desglosa el porcentaje por categoría", () => {
    const checks = [
      check({ category: "authenticity", result: "OK" }),
      check({ category: "authenticity", result: "ERROR" }),
      check({ category: "imageQuality", result: "OK" }),
    ];
    const score = computeDocumentCheckScore(checks, {}, null);
    const authenticity = score.byCategory.find((c) => c.category === "authenticity");
    const imageQuality = score.byCategory.find((c) => c.category === "imageQuality");
    expect(authenticity?.percentage).toBe(50);
    expect(imageQuality?.percentage).toBe(100);
  });
});

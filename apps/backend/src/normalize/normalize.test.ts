import { describe, expect, it } from "vitest";
import { normalizeResult, normalizeStepStatus, normalizeValidationStatus } from "./status";
import { parseFlexibleDate } from "./dates";
import { maskEmail, maskName } from "./mask";
import { buildNormalizedValidationDetail } from "./validation-detail";
import { fixtures } from "@fad-console/validation-schemas";

describe("normalizeValidationStatus", () => {
  it("mapea variantes en español e inglés preservando el valor original por separado", () => {
    expect(normalizeValidationStatus("EN_PROCESO")).toBe("IN_PROGRESS");
    expect(normalizeValidationStatus("TERMINADO")).toBe("COMPLETED");
    expect(normalizeValidationStatus("FINISHED")).toBe("COMPLETED");
    expect(normalizeValidationStatus("PENDING")).toBe("CREATED");
    expect(normalizeValidationStatus("algo-no-documentado")).toBe("UNKNOWN");
    expect(normalizeValidationStatus(null)).toBe("UNKNOWN");
  });
});

describe("normalizeStepStatus / normalizeResult", () => {
  it("normaliza estados de paso", () => {
    expect(normalizeStepStatus("COMPLETED")).toBe("COMPLETED");
    expect(normalizeStepStatus("otro")).toBe("UNKNOWN");
  });
  it("normaliza resultado Aprobado/Approved", () => {
    expect(normalizeResult("Aprobado")).toBe("APPROVED");
    expect(normalizeResult("Approved")).toBe("APPROVED");
    expect(normalizeResult("Rechazado")).toBe("REJECTED");
    expect(normalizeResult(undefined)).toBe("UNKNOWN");
  });
});

describe("parseFlexibleDate", () => {
  it("parsea DD/MM/YYYY HH:mm:ss (formato de webhooks)", () => {
    const result = parseFlexibleDate("04/07/2022 01:13:52");
    expect(result.iso).toBe("2022-07-04T01:13:52.000Z");
    expect(result.raw).toBe("04/07/2022 01:13:52");
  });

  it("parsea YYYY-MM-DD HH:mm (formato de getValidationData)", () => {
    const result = parseFlexibleDate("2023-02-07 15:56");
    expect(result.iso).toBe("2023-02-07T15:56:00.000Z");
  });

  it("parsea ISO 8601", () => {
    const result = parseFlexibleDate("2023-10-12T10:02:22.000Z");
    expect(result.iso).toBe("2023-10-12T10:02:22.000Z");
  });

  it("parsea timestamps numéricos en ms y en s", () => {
    expect(parseFlexibleDate(1680140874729).iso).toBe(new Date(1680140874729).toISOString());
    expect(parseFlexibleDate(1680140874).iso).toBe(new Date(1680140874 * 1000).toISOString());
  });

  it("nunca lanza ante un formato no reconocido, preserva el valor crudo", () => {
    const result = parseFlexibleDate("no-es-una-fecha");
    expect(result.iso).toBeNull();
    expect(result.raw).toBe("no-es-una-fecha");
  });

  it("maneja null/undefined sin lanzar", () => {
    expect(parseFlexibleDate(null).iso).toBeNull();
    expect(parseFlexibleDate(undefined).iso).toBeNull();
  });
});

describe("mask", () => {
  it("enmascara nombres preservando la primera letra de cada palabra", () => {
    const masked = maskName("Edwin Hernandez");
    expect(masked).not.toBe("Edwin Hernandez");
    expect(masked.startsWith("E")).toBe(true);
  });

  it("enmascara correos preservando dominio", () => {
    const masked = maskEmail("cliente@example.com");
    expect(masked.endsWith("@example.com")).toBe(true);
    expect(masked).not.toContain("cliente");
  });

  it("devuelve un placeholder para valores vacíos", () => {
    expect(maskName(null)).toBe("—");
    expect(maskEmail(undefined)).toBe("—");
  });
});

describe("buildNormalizedValidationDetail", () => {
  it("combina fixtures de creación/pasos/detalle en una estructura coherente", () => {
    const detail = buildNormalizedValidationDetail({
      validationId: "demo-1",
      processName: "Proceso demo",
      environmentName: "Demo",
      templateName: "Plantilla demo",
      requestSteps: {
        location: { order: 0, show: true },
        privacyNotice: { order: 1, show: true },
        captureId: { order: 2, show: true },
        formValidationId: { order: 3, show: true },
        liveness: { order: 4, show: true },
        fingerprints: { order: 5, show: true },
      },
      fallbackClient: { name: "Cliente Demo", mail: "demo@example.com", phone: "+573000000000" },
      createResponse: fixtures.createValidationResponseFixture,
      stepResponse: fixtures.getValidationStepResponseFixture,
      dataResponse: fixtures.getValidationDataResponseFixture,
    });

    expect(detail.status).toBe("COMPLETED");
    expect(detail.rawStatus).toBe("TERMINADO");
    expect(detail.result).toBe("APPROVED");
    expect(detail.client.nameMasked).not.toContain("CLIENTE DE PRUEBA DEMO");
    expect(detail.steps.length).toBeGreaterThan(0);
    expect(detail.steps[0]!.order).toBeLessThanOrEqual(detail.steps[detail.steps.length - 1]!.order);
    expect(detail.progressPercent).toBeGreaterThan(0);
    expect(detail.comparisonPercentage).toBeCloseTo(99.5);
    expect(detail.externalValidations).toHaveProperty("accuant_validation");
    expect(detail.files.length).toBeGreaterThan(0);
    expect(detail.raw.dataResponse).toBeTruthy();
  });

  it("no lanza cuando las respuestas de la API todavía no existen (validación recién creada)", () => {
    const detail = buildNormalizedValidationDetail({
      validationId: "demo-2",
      processName: "Proceso nuevo",
      environmentName: "Demo",
      templateName: null,
      requestSteps: { location: { order: 0, show: true } },
      fallbackClient: { name: "Cliente", mail: null, phone: null },
      createResponse: null,
      stepResponse: null,
      dataResponse: null,
    });
    expect(detail.status).toBe("UNKNOWN");
    expect(detail.steps).toHaveLength(1);
    expect(detail.steps[0]!.status).toBe("PENDING");
    expect(detail.progressPercent).toBe(0);
  });
});

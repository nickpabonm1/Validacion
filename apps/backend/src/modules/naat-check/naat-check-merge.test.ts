import { describe, expect, it } from "vitest";
import type { NormalizedValidationDetail } from "@fad-console/shared-types";
import { toJsonField } from "../../lib/json-field";
import { applyNaatCheckRecheckToDetail } from "./naat-check-merge";

function baseDetail(): NormalizedValidationDetail {
  return {
    validationId: "v1",
    processName: "Proceso",
    environmentName: "Env",
    templateName: null,
    status: "COMPLETED",
    rawStatus: "COMPLETED",
    result: "APPROVED",
    rawResult: "APPROVED",
    client: { name: null, nameMasked: "***", email: null, emailMasked: "***", phone: null },
    clientDetails: null,
    steps: [],
    documentChecks: [],
    documentCheckRejection: null,
    governmentValidation: null,
    naatCheckResult: null,
    naatCheckRecheckResult: null,
    mediaAssets: [],
    raw: { createResponse: null, stepResponse: null, dataResponse: null },
  } as unknown as NormalizedValidationDetail;
}

describe("applyNaatCheckRecheckToDetail", () => {
  it("no hace nada cuando no hay resultado guardado", () => {
    const detail = baseDetail();
    applyNaatCheckRecheckToDetail(detail, null, "LOW");
    expect(detail.naatCheckRecheckResult).toBeNull();
    expect(detail.documentChecks).toHaveLength(0);
  });

  it("agrega un check sintético OK cuando el riesgo está dentro del nivel aceptado", () => {
    const detail = baseDetail();
    const stored = toJsonField({ risk: "LOW", key: null, result: true, requestedAt: "2026-09-03T00:00:00.000Z" });
    applyNaatCheckRecheckToDetail(detail, stored, "MEDIUM");
    expect(detail.naatCheckRecheckResult).toEqual({ risk: "LOW", key: null, result: true, requestedAt: "2026-09-03T00:00:00.000Z" });
    expect(detail.documentChecks).toHaveLength(1);
    expect(detail.documentChecks[0]).toMatchObject({ category: "naatCheckRecheck", result: "OK" });
  });

  it("marca el check como riesgo (no OK) cuando el riesgo supera el nivel aceptado", () => {
    const detail = baseDetail();
    const stored = toJsonField({ risk: "HIGH", key: "TAMP_FOTO_DETECTED", result: false, requestedAt: "2026-09-03T00:00:00.000Z" });
    applyNaatCheckRecheckToDetail(detail, stored, "LOW");
    expect(detail.documentChecks[0]).toMatchObject({ category: "naatCheckRecheck", result: "RISK_HIGH" });
    expect(detail.documentChecks[0]!.resultDescription).toContain("TAMP_FOTO_DETECTED");
  });

  it("un riesgo MEDIUM pasa cuando el nivel aceptado es MEDIUM, pero no cuando es LOW", () => {
    const stored = toJsonField({ risk: "MEDIUM", key: "TEMP_DATA_RISK", result: false, requestedAt: "2026-09-03T00:00:00.000Z" });

    const acceptsMedium = baseDetail();
    applyNaatCheckRecheckToDetail(acceptsMedium, stored, "MEDIUM");
    expect(acceptsMedium.documentChecks[0]!.result).toBe("OK");

    const acceptsOnlyLow = baseDetail();
    applyNaatCheckRecheckToDetail(acceptsOnlyLow, stored, "LOW");
    expect(acceptsOnlyLow.documentChecks[0]!.result).toBe("RISK_MEDIUM");
  });
});

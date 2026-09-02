import { describe, expect, it } from "vitest";
import { buildMetadataJson, buildWebSdkNormalizedDetail, type WebSdkNormalizeInput } from "./websdk-normalize";

function baseInput(overrides: Partial<WebSdkNormalizeInput> = {}): WebSdkNormalizeInput {
  return {
    validationId: "vid-123",
    processName: "Onboarding Web SDK",
    environmentName: "Demo",
    templateName: null,
    client: { name: "Cliente Demo", mail: "cliente@ejemplo.com", phone: "+573000000000" },
    acuant: {
      frontImage: "base64front",
      backImage: "base64back",
      idPhoto: "base64idphoto",
      documentInstance: "doc-1",
      ocr: { documentNumber: "0000000000", fullName: "CLIENTE DEMO" },
    },
    facetec: { selfie: "base64selfie", faceScan: "scan-data", auditTrail: ["base64audit"], sessionId: "session-1", status: 0 },
    check: { risk: "LOW", key: "", result: true },
    compare: { confidence: 97.5, qualityFace1: 90, qualityFace2: 88 },
    saveResult: { status: "TERMINADO", porcentCompare: 97.5 },
    startedAt: "2026-01-01T10:00:00.000Z",
    completedAt: "2026-01-01T10:05:00.000Z",
    ...overrides,
  };
}

describe("buildWebSdkNormalizedDetail", () => {
  it("marca la ejecución como COMPLETED/APPROVED cuando el riesgo es LOW y el match facial pasa", () => {
    const detail = buildWebSdkNormalizedDetail(baseInput());
    expect(detail.status).toBe("COMPLETED");
    expect(detail.result).toBe("APPROVED");
    expect(detail.alerts).toHaveLength(0);
  });

  it("marca REJECTED y agrega una alerta cuando el riesgo de NAAT-CHECK no es LOW ni result=true", () => {
    const detail = buildWebSdkNormalizedDetail(baseInput({ check: { risk: "HIGH", key: "TAMP_FOTO_RISK", result: false } }));
    expect(detail.result).toBe("REJECTED");
    expect(detail.alerts).toHaveLength(1);
    expect(String((detail.alerts[0] as { message: string }).message)).toContain("HIGH");
  });

  it("extrae las imágenes de Acuant y Facetec como mediaAssets con dataUrl con prefijo", () => {
    const detail = buildWebSdkNormalizedDetail(baseInput());
    const labels = detail.mediaAssets.map((a) => a.label);
    expect(labels).toEqual(expect.arrayContaining(["documentFront", "documentBack", "idPhoto", "selfie", "auditTrail"]));
    for (const asset of detail.mediaAssets) {
      expect(asset.dataUrl.startsWith("data:image/jpeg;base64,")).toBe(true);
    }
  });

  it("no genera un mediaAsset para imágenes ausentes (p. ej. sin reverso de documento)", () => {
    const detail = buildWebSdkNormalizedDetail(baseInput({ acuant: { ...baseInput().acuant, backImage: undefined } }));
    expect(detail.mediaAssets.some((a) => a.label === "documentBack")).toBe(false);
  });

  it("enmascara nombre y correo del cliente sin exponer el dato real", () => {
    const detail = buildWebSdkNormalizedDetail(baseInput());
    expect(detail.client.name).toBeNull();
    expect(detail.client.email).toBeNull();
    expect(detail.client.nameMasked).not.toBe("Cliente Demo");
    expect(detail.client.emailMasked).toContain("@ejemplo.com");
    expect(detail.client.emailMasked).not.toContain("cliente@");
  });

  it("incluye los 5 pasos del flujo en orden", () => {
    const detail = buildWebSdkNormalizedDetail(baseInput());
    expect(detail.steps.map((s) => s.key)).toEqual(["captureId", "check", "liveness", "compareFaces", "saveValidationData"]);
    expect(detail.steps.every((s) => s.status === "COMPLETED")).toBe(true);
  });

  it("expone el % de comparación facial y las validaciones externas (naat_check, face_comparison)", () => {
    const detail = buildWebSdkNormalizedDetail(baseInput());
    expect(detail.comparisonPercentage).toBe(97.5);
    expect(detail.externalValidations.naat_check).toMatchObject({ risk: "LOW" });
    expect(detail.externalValidations.face_comparison).toMatchObject({ confidence: 97.5 });
  });
});

describe("buildMetadataJson", () => {
  it("incluye validationId, startDate y los archivos de documento disponibles en `documents[0].files`", () => {
    const metadata = buildMetadataJson(baseInput());
    expect(metadata.validationId).toBe("vid-123");
    expect(metadata.startDate).toBe("2026-01-01T10:00:00.000Z");
    expect((metadata.documents as Array<{ files: string[] }>)[0]!.files).toEqual(["ineAnverso.png", "ineReverso.png"]);
  });

  it("omite ineReverso.png de `files` cuando no hay imagen de reverso", () => {
    const metadata = buildMetadataJson(baseInput({ acuant: { ...baseInput().acuant, backImage: undefined } }));
    expect((metadata.documents as Array<{ files: string[] }>)[0]!.files).toEqual(["ineAnverso.png"]);
  });

  it("usa el % de comparación facial como idSelfieSimilarity", () => {
    const metadata = buildMetadataJson(baseInput());
    expect(metadata.idSelfieSimilarity).toBe(97.5);
  });
});

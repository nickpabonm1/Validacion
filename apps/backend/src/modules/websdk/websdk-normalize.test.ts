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

  it("extrae ocrPhoto/ocrSignature/ocrFingerprint (imágenes embebidas en el OCR de Acuant) como mediaAssets", () => {
    const detail = buildWebSdkNormalizedDetail(
      baseInput({
        acuant: {
          ...baseInput().acuant,
          ocrPhoto: "base64ocrphoto",
          ocrSignature: "base64ocrsignature",
          ocrFingerprint: "base64ocrfingerprint",
        },
      }),
    );
    const labels = detail.mediaAssets.map((a) => a.label);
    expect(labels).toEqual(expect.arrayContaining(["ocrPhoto", "ocrSignature", "ocrFingerprint"]));
  });

  it("agrega las alertas propias de Acuant (además de la de NAAT-CHECK cuando aplica)", () => {
    const detail = buildWebSdkNormalizedDetail(
      baseInput({ acuant: { ...baseInput().acuant, alerts: [{ Name: "TAMPER", Description: "Posible manipulación" }] } }),
    );
    expect(detail.alerts).toHaveLength(1);
    expect(detail.alerts[0]).toMatchObject({ Name: "TAMPER" });
  });

  it("combina classification con las métricas de calidad de imagen por lado (prefijadas front/back)", () => {
    const detail = buildWebSdkNormalizedDetail(
      baseInput({
        acuant: {
          ...baseInput().acuant,
          classification: { type: "ine", countryCode: "MEX" },
          frontQuality: { glare: 1, dpi: 300 },
          backQuality: { sharpness: 0.9 },
        },
      }),
    );
    expect(detail.classification).toMatchObject({
      type: "ine",
      countryCode: "MEX",
      frontGlare: 1,
      frontDpi: 300,
      backSharpness: 0.9,
    });
  });

  it("mantiene classification en null cuando Acuant no devuelve clasificación ni métricas de calidad", () => {
    const detail = buildWebSdkNormalizedDetail(baseInput());
    expect(detail.classification).toBeNull();
  });

  it("incluye document_validation cuando Acuant devuelve idData.validation no vacío", () => {
    const detail = buildWebSdkNormalizedDetail(
      baseInput({ acuant: { ...baseInput().acuant, validation: { isRealId: true } } }),
    );
    expect(detail.externalValidations.document_validation).toEqual({ isRealId: true });
  });

  it("no agrega document_validation cuando `validation` está ausente o vacío", () => {
    const detail = buildWebSdkNormalizedDetail(baseInput({ acuant: { ...baseInput().acuant, validation: {} } }));
    expect(detail.externalValidations.document_validation).toBeUndefined();
  });

  it("agrega solo las validaciones externas de saveValidationData que realmente vienen con valor", () => {
    const detail = buildWebSdkNormalizedDetail(
      baseInput({
        saveResult: {
          status: "TERMINADO",
          porcentCompare: 97.5,
          dataValidationRenapo: { match: true },
          dataValidationSat: null,
        },
      }),
    );
    expect(detail.externalValidations.dataValidationRenapo).toEqual({ match: true });
    expect(detail.externalValidations.dataValidationSat).toBeUndefined();
  });

  it("agrega originalPhoto (propio de Regula) como mediaAsset cuando viene presente", () => {
    const detail = buildWebSdkNormalizedDetail(baseInput({ acuant: { ...baseInput().acuant, originalPhoto: "base64original" } }));
    expect(detail.mediaAssets.some((a) => a.label === "originalPhoto")).toBe(true);
  });

  it("no genera un mediaAsset originalPhoto cuando Acuant no lo devuelve", () => {
    const detail = buildWebSdkNormalizedDetail(baseInput());
    expect(detail.mediaAssets.some((a) => a.label === "originalPhoto")).toBe(false);
  });

  it("preserva regulaData/regulaResponse en externalValidations sin interpretarlos", () => {
    const detail = buildWebSdkNormalizedDetail(
      baseInput({
        acuant: {
          ...baseInput().acuant,
          regulaData: [{ key: "documentNumber", value: "0000000000" }],
          regulaResponse: { providerStatus: "ok" },
        },
      }),
    );
    expect(detail.externalValidations.regula_data).toEqual([{ key: "documentNumber", value: "0000000000" }]);
    expect(detail.externalValidations.regula_response).toEqual({ providerStatus: "ok" });
  });

  it("no agrega regula_data/regula_response cuando están ausentes (nunca se fabrican)", () => {
    const detail = buildWebSdkNormalizedDetail(baseInput());
    expect(detail.externalValidations.regula_data).toBeUndefined();
    expect(detail.externalValidations.regula_response).toBeUndefined();
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

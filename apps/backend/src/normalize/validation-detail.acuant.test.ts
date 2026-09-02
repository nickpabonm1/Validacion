import { describe, expect, it } from "vitest";
import { buildNormalizedValidationDetail } from "./validation-detail";

/**
 * Fixture sanitizada (recortada, valores ficticios) derivada de una respuesta REAL de
 * getValidationStep para Acuant (`features.provider: 2`), compartida por el operador para
 * confirmar que la extracción de "Validación de ID" también cubre este proveedor. Confirma que
 * `steps.captureId.data.alerts` de Acuant es un array PLANO de tests AssureID
 * ({Name,Information,Disposition,Result,...}) — completamente distinto de la forma categorizada
 * ({textCrossChecks,...}) que usan otros proveedores (ver validation-detail.captureid.test.ts).
 * Se conserva solo un subconjunto representativo — el propósito es probar la extracción.
 */
const stepResponseFixture = {
  success: true,
  error: "",
  code: null,
  data: {
    processName: "Validación Autentic Sign",
    validation: { idProcess: "demo-validation-id", status: "FINISHED" },
    client: { name: "PRUEBA", mail: "demo@example.com", phone: "+570000000000" },
    steps: {
      captureId: {
        order: 2,
        status: "COMPLETED",
        show: true,
        configuration: {},
        features: { viewRequired: { always: false }, provider: 2 },
        input: {},
        data: {
          ocr: [
            { key: "Full Name", value: "NICOLAS PABON MEDINA", type: "string" },
            { key: "Document Number", value: "000238195", type: "string" },
          ],
          alerts: [
            {
              Actions: "...",
              Description: "Verified that the birth date check digit is correct.",
              Disposition: "The birth date check digit is correct",
              Id: "49daa771-1439-4fa3-938c-4c4eeb9a378b",
              Information:
                "Check digits are used in the machine readable zone (MRZ) to provide verification that the data is correctly interpreted.",
              Key: "Birth Date Check Digit",
              Model: null,
              Name: "Birth Date Check Digit",
              Result: 1,
            },
            {
              Actions: "...",
              Description: "Examines a document for evidence of tampering",
              Disposition: "No evidence of document tampering was detected.",
              Id: "bbae7447-bee3-4af2-a127-0e78c51aa1b3",
              Information: "Tested the document for evidence of tampering",
              Key: "Document Tampering Detection",
              Model: "Text Tampering Detection V2.1",
              Name: "Document Tampering Detection",
              Result: 1,
            },
          ],
          classification: { countryCode: "COL", cardType: 4, cardTypeDescription: "Identification Card" },
        },
      },
    },
    validationKeys: { key: "DEMO", vector: "DEMO", validationId: "demo-validation-id" },
  },
};

describe("buildNormalizedValidationDetail — Acuant (AssureID, alerts como array plano)", () => {
  const detail = buildNormalizedValidationDetail({
    validationId: "demo-validation-id",
    processName: "Validación Autentic Sign",
    environmentName: "Demo",
    templateName: null,
    requestSteps: { captureId: { order: 2, show: true } },
    fallbackClient: { name: "PRUEBA", mail: "demo@example.com", phone: "+570000000000" },
    createResponse: null,
    stepResponse: stepResponseFixture as never,
    dataResponse: null,
  });

  it("extrae el OCR del array {key,value,type}", () => {
    expect(detail.ocr).toMatchObject({ "Full Name": "NICOLAS PABON MEDINA", "Document Number": "000238195" });
  });

  it("convierte el array plano de alerts de Acuant a documentChecks, con category 'documentValidation' y sin página", () => {
    expect(detail.documentChecks).toHaveLength(2);
    expect(detail.documentChecks.every((c) => c.category === "documentValidation" && c.page === null)).toBe(true);
  });

  it("mapea Result:1 a 'OK' y usa Name/Information/Disposition, sin fabricar texto que FAD no devolvió", () => {
    const tamperingCheck = detail.documentChecks.find((c) => c.name === "Document Tampering Detection");
    expect(tamperingCheck).toMatchObject({
      result: "OK",
      description: "Tested the document for evidence of tampering",
      resultDescription: "No evidence of document tampering was detected.",
      sources: null,
    });
  });
});

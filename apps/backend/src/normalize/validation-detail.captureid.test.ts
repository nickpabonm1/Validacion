import { describe, expect, it } from "vitest";
import { buildNormalizedValidationDetail } from "./validation-detail";

/**
 * Fixture sanitizada (recortada, valores ficticios) derivada de una respuesta REAL de
 * getValidationStep/getValidationData que el operador compartió al reportar que el reporte no
 * mostraba esta información. Confirma la forma real de `steps.captureId.data.{ocr,alerts}` (no
 * documentada en el PDF ni en la colección Postman): `ocr` es un array `{key,value}` (no un
 * objeto), y `alerts` tiene 5 categorías con dos formas distintas (planas: textCrossChecks/
 * mrzCheckDigit/dateChecks; agrupadas por página: authenticity/imageQuality). Se conserva solo
 * un subconjunto representativo de cada categoría — el propósito es probar la extracción, no
 * reproducir la respuesta completa (que trae ~40 entradas de textCrossChecks).
 */
const stepResponseFixture = {
  success: true,
  error: "",
  code: null,
  data: {
    processName: "PRUEBA",
    validation: { idProcess: "demo-validation-id", status: "IN_PROCESS" },
    client: { name: "PRUEBA", mail: "demo@example.com", phone: "+570000000000" },
    steps: {
      captureId: {
        order: 2,
        status: "COMPLETED",
        show: true,
        configuration: {},
        features: { provider: 1 },
        data: {
          ocr: [
            { key: "Given Names", value: "DEMO" },
            { key: "Given Names MRZ", value: "DEMO" },
            { key: "Document Number", value: "000000000" },
          ],
          classification: { countryCode: "COL", cardType: 12, cardTypeDescription: "Identity Card" },
          alerts: {
            textCrossChecks: [
              {
                type: { code: 25, name: "Surname And Given Names" },
                result: { code: 1, name: "OK", description: "Check was performed and result is POSITIVE" },
                sources: ["MRZ", "VISUAL"],
              },
              {
                type: { code: 0, name: "Document Class Code" },
                result: { code: 2, name: "WAS_NOT_DONE", description: "Check was NOT PERFORMED" },
                sources: ["MRZ"],
              },
            ],
            authenticity: [
              {
                page: 1,
                checks: [
                  {
                    type: { code: 4, name: "IMAGE_PATTERN", description: "Image patterns presence/absence check" },
                    result: { code: 1, name: "OK", description: "Check was performed and result is POSITIVE" },
                    elements: [],
                  },
                ],
              },
              {
                page: 2,
                checks: [
                  {
                    type: { code: 2097152, name: "LIVENESS", description: "Document liveness check" },
                    result: { code: 1, name: "OK", description: "Check was performed and result is POSITIVE" },
                    elements: [],
                  },
                ],
              },
            ],
            imageQuality: [
              {
                page: 1,
                checks: [
                  { type: { code: 1, name: "IMAGE_FOCUS", description: "Signals whether image is in focus" }, result: { code: 1, name: "OK", description: "Check was performed and result is POSITIVE" } },
                ],
              },
              {
                page: 2,
                checks: [
                  { type: { code: 7, name: "PORTRAIT", description: "Signals if the portrait is present" }, result: { code: 2, name: "WAS_NOT_DONE", description: "Check was NOT PERFORMED" } },
                ],
              },
            ],
            mrzCheckDigit: [
              { type: { code: 80, name: "Document Number Checkdigit" }, result: { code: 1, name: "OK", description: "Check was performed and result is POSITIVE" } },
            ],
            dateChecks: [
              { type: { code: 1, name: "DOCUMENT_EXPIRY", description: "Indicates the document expiry status" }, result: { code: 1, name: "OK", description: "Check was performed and result is POSITIVE" } },
            ],
          },
        },
      },
    },
    validationKeys: { key: "DEMOKEY", vector: "DEMOVECTOR", validationId: "demo-validation-id" },
  },
};

const dataResponseFixture = {
  success: true,
  error: "",
  code: null,
  data: {
    client: {
      clientId: null,
      nombre: "PRUEBA",
      apellidoPaterno: "PABON",
      apellidoMaterno: "MEDINA",
      curp: null,
      rfc: null,
    },
    deviceInfo: { platform: "Web", deviceModel: "iPhone" },
    networkInfo: {},
    latitude: null,
    longitude: null,
    companyId: "DEMO",
    status: "IN_PROCESS",
    startDate: "2026-01-01 10:00",
    idValidation: "demo-validation-id",
    porcentCompare: null,
    endDate: null,
    result: null,
    files: [],
    extraInfo: {},
    externalValidations: {},
    folio: null,
    folioProceso: "FP-000123",
    folioCecoban: null,
    respuestaRenapo: "02 CURP: DATOS INCORRECTOS: [Falta el campo <sexo>.]",
    respuestaCecoban: null,
    respuestaEnroll: null,
    dataValidationRenapo: null,
    dataValidationSat: null,
    dataValidationFimpeRPADto: null,
    dataValidationFimpeLN: null,
    dataValidationId: null,
    idVsRegistraduriaSimilarity: null,
    naatCheck: { result: true, id: "demo-naat-id", risk: "LOW", key: "" },
    validationProcessResult: null,
  },
};

describe("buildNormalizedValidationDetail — datos reales del paso captureId", () => {
  const detail = buildNormalizedValidationDetail({
    validationId: "demo-validation-id",
    processName: "PRUEBA",
    environmentName: "Demo",
    templateName: null,
    requestSteps: { captureId: { order: 2, show: true } },
    fallbackClient: { name: "PRUEBA", mail: "demo@example.com", phone: "+570000000000" },
    createResponse: null,
    stepResponse: stepResponseFixture,
    dataResponse: dataResponseFixture,
  });

  it("extrae el OCR del array {key,value} de steps.captureId.data.ocr (antes no se leía)", () => {
    expect(detail.ocr).toMatchObject({ "Given Names": "DEMO", "Document Number": "000000000" });
  });

  it("extrae las 5 categorías de documentChecks (el orden de agrupación/despliegue lo decide el frontend)", () => {
    const categories = new Set(detail.documentChecks.map((c) => c.category));
    expect(categories).toEqual(new Set(["textCrossChecks", "imageQuality", "mrzCheckDigit", "dateChecks", "authenticity"]));
  });

  it("distingue página 1/2 para authenticity e imageQuality, sin página para las categorías planas", () => {
    const auth = detail.documentChecks.filter((c) => c.category === "authenticity");
    expect(auth.map((c) => c.page).sort()).toEqual([1, 2]);
    const textCross = detail.documentChecks.filter((c) => c.category === "textCrossChecks");
    expect(textCross.every((c) => c.page === null)).toBe(true);
  });

  it("preserva result/resultDescription/sources reales sin fabricar texto", () => {
    const surnameCheck = detail.documentChecks.find((c) => c.name === "Surname And Given Names");
    expect(surnameCheck).toMatchObject({
      result: "OK",
      resultDescription: "Check was performed and result is POSITIVE",
      sources: ["MRZ", "VISUAL"],
    });
    const notDone = detail.documentChecks.find((c) => c.name === "Document Class Code");
    expect(notDone?.result).toBe("WAS_NOT_DONE");
  });

  it("extrae governmentValidation solo con los campos poblados (nunca fabrica campos vacíos)", () => {
    expect(detail.governmentValidation).toEqual({
      folioProceso: "FP-000123",
      respuestaRenapo: "02 CURP: DATOS INCORRECTOS: [Falta el campo <sexo>.]",
    });
  });

  it("extrae naatCheckResult tal cual lo devuelve FAD", () => {
    expect(detail.naatCheckResult).toEqual({ result: true, id: "demo-naat-id", risk: "LOW", key: "" });
  });

  it("extrae clientDetails excluyendo nombre/clientId y campos nulos", () => {
    expect(detail.clientDetails).toEqual({ apellidoPaterno: "PABON", apellidoMaterno: "MEDINA" });
  });
});

describe("buildNormalizedValidationDetail — nombre del cliente corregido con el OCR del documento", () => {
  it("prioriza el nombre completo leído del documento (OCR) sobre el valor de prueba enviado al crear la validación", () => {
    const detail = buildNormalizedValidationDetail({
      validationId: "demo-ocr-name",
      processName: "PRUEBA",
      environmentName: "Demo",
      templateName: null,
      requestSteps: { captureId: { order: 2, show: true } },
      fallbackClient: { name: "PRUEBA", mail: "demo@example.com", phone: "+570000000000" },
      createResponse: null,
      stepResponse: {
        success: true,
        error: "",
        code: null,
        data: {
          ...stepResponseFixture.data,
          steps: {
            captureId: {
              ...stepResponseFixture.data.steps.captureId,
              data: {
                ...stepResponseFixture.data.steps.captureId.data,
                ocr: [
                  { key: "Given Name", value: "JUAN CARLOS" },
                  { key: "Surname", value: "PEREZ GOMEZ" },
                ],
              },
            },
          },
        },
      },
      dataResponse: dataResponseFixture,
    });

    // El nombre enviado al crear la validación ("PRUEBA", un valor de prueba genérico) queda
    // reemplazado por el nombre real leído del documento (OCR), sin descartarse: sigue disponible
    // en `clientDetails`/los datos crudos de FAD para trazabilidad.
    expect(detail.client.name).toBe("JUAN CARLOS PEREZ GOMEZ");
  });
});

describe("buildNormalizedValidationDetail — pasos administrativos con todo en null junto a pasos reales", () => {
  it("no descarta los pasos reales cuando FAD incluye pasos administrativos (instructionsPermissions, processCompleted) con status/configuration/features en null", () => {
    const detail = buildNormalizedValidationDetail({
      validationId: "demo-null-steps",
      processName: "PRUEBA",
      environmentName: "Demo",
      templateName: null,
      requestSteps: { captureId: { order: 2, show: true } },
      fallbackClient: { name: "PRUEBA", mail: "demo@example.com", phone: "+570000000000" },
      createResponse: null,
      stepResponse: {
        success: true,
        error: "",
        code: null,
        data: {
          ...stepResponseFixture.data,
          steps: {
            instructionsPermissions: { id: null, order: 0, status: null, show: true, configuration: null, features: null, input: null, data: null },
            ...stepResponseFixture.data.steps,
            processCompleted: { id: null, order: 5, status: null, show: true, configuration: null, features: null, input: null, data: null },
          },
        },
      } as never,
      dataResponse: dataResponseFixture as never,
    });

    const captureId = detail.steps.find((s) => s.key === "captureId");
    expect(captureId?.status).toBe("COMPLETED");
    expect(detail.documentChecks.length).toBeGreaterThan(0);

    const instructions = detail.steps.find((s) => s.key === "instructionsPermissions");
    expect(instructions?.status).toBe("PENDING");
  });
});

describe("buildNormalizedValidationDetail — sin datos de captureId", () => {
  it("documentChecks/governmentValidation/naatCheckResult/clientDetails no rompen con datos ausentes", () => {
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
    expect(detail.documentChecks).toEqual([]);
    expect(detail.governmentValidation).toBeNull();
    expect(detail.naatCheckResult).toBeNull();
    expect(detail.clientDetails).toBeNull();
  });
});

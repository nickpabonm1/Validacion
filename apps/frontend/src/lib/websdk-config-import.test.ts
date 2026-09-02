import { describe, expect, it } from "vitest";
import { parseWebSdkConfigImport } from "./websdk-config-import";

describe("parseWebSdkConfigImport", () => {
  it("aplica solo los campos presentes en el archivo, respetando el shape de WebSdkConfigInput", () => {
    const result = parseWebSdkConfigImport({
      sdkBaseUrl: "https://uathaapiframe.firmaautografa.com",
      acuantPassiveUsername: "usuario-acuant",
      acuantPassivePassword: "clave-acuant",
      checkMaxAttempts: 5,
      acuantParams: { idData: true, idPhoto: false, manualCapture: true },
    });
    expect(result.matched).toEqual(
      expect.arrayContaining(["sdkBaseUrl", "acuantPassiveUsername", "acuantPassivePassword", "checkMaxAttempts", "acuantParams"]),
    );
    expect(result.values.checkMaxAttempts).toBe(5);
    expect(result.values.acuantParams).toEqual({ idData: true, idPhoto: false, manualCapture: true });
    expect(result.warnings).toEqual([]);
  });

  it("aplica los campos de CaptureId (sin credenciales, a diferencia de Acuant/Regula)", () => {
    const result = parseWebSdkConfigImport({
      documentCaptureEngine: "CAPTURE_ID",
      captureIdParams: { idPhoto: true, originalPhoto: false },
      captureIdConfiguration: { views: { instructions: true } },
    });
    expect(result.matched).toEqual(
      expect.arrayContaining(["documentCaptureEngine", "captureIdParams", "captureIdConfiguration"]),
    );
    expect(result.values.documentCaptureEngine).toBe("CAPTURE_ID");
    expect(result.values.captureIdParams).toEqual({ idPhoto: true, originalPhoto: false });
    expect(result.warnings).toEqual([]);
  });

  it("no toca campos ausentes del archivo (no aplica valores por defecto sobre lo que ya existe)", () => {
    const result = parseWebSdkConfigImport({ sdkBaseUrl: "https://x.test" });
    expect(Object.keys(result.values)).toEqual(["sdkBaseUrl"]);
    expect(result.values.checkMaxAttempts).toBeUndefined();
  });

  it("ignora campos desconocidos y campos con formato inválido, con una advertencia por cada uno", () => {
    const result = parseWebSdkConfigImport({
      sdkBaseUrl: "no-es-una-url",
      campoQueNoExiste: "algo",
    });
    expect(result.values.sdkBaseUrl).toBeUndefined();
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining("sdkBaseUrl"), expect.stringContaining("campoQueNoExiste")]),
    );
  });

  it("rechaza un archivo que no es un objeto JSON", () => {
    expect(parseWebSdkConfigImport([1, 2, 3]).warnings).toEqual(expect.arrayContaining([expect.stringContaining("objeto JSON")]));
    expect(parseWebSdkConfigImport("texto").warnings.length).toBeGreaterThan(0);
    expect(parseWebSdkConfigImport(null).warnings.length).toBeGreaterThan(0);
  });
});

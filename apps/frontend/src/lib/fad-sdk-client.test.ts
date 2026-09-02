import { describe, expect, it } from "vitest";
import { buildCaptureIdOcr, flattenRegulaAlerts, pickCaptureIdImage, splitOcrImages, toDataUri } from "./fad-sdk-client";

const LONG_BASE64 = "A".repeat(150); // > 100 chars, solo caracteres base64 válidos

describe("splitOcrImages", () => {
  it("separa photo/signature/fingerprint cuando parecen base64 embebido", () => {
    const result = splitOcrImages({
      documentNumber: "0000000000",
      fullName: "CLIENTE DEMO",
      photo: LONG_BASE64,
      signature: LONG_BASE64,
      fingerprint: LONG_BASE64,
    });

    expect(result.ocrPhoto).toBe(`data:image/jpeg;base64,${LONG_BASE64}`);
    expect(result.ocrSignature).toBe(`data:image/jpeg;base64,${LONG_BASE64}`);
    expect(result.ocrFingerprint).toBe(`data:image/jpeg;base64,${LONG_BASE64}`);
    expect(result.ocr).toEqual({ documentNumber: "0000000000", fullName: "CLIENTE DEMO" });
  });

  it("deja los campos cortos de texto (no imágenes) dentro de `ocr`", () => {
    const result = splitOcrImages({ documentNumber: "0000000000", sex: "M" });
    expect(result.ocr).toEqual({ documentNumber: "0000000000", sex: "M" });
    expect(result.ocrPhoto).toBeUndefined();
  });

  it("no confunde un valor de texto normal (corto) con una imagen aunque la clave coincida", () => {
    const result = splitOcrImages({ signature: "N/A" });
    expect(result.ocr).toEqual({ signature: "N/A" });
    expect(result.ocrSignature).toBeUndefined();
  });

  it("retorna ocr undefined si no hay OCR o si quedó vacío tras extraer las imágenes", () => {
    expect(splitOcrImages(undefined).ocr).toBeUndefined();
    const result = splitOcrImages({ photo: LONG_BASE64 });
    expect(result.ocr).toBeUndefined();
    expect(result.ocrPhoto).toBeDefined();
  });
});

describe("flattenRegulaAlerts", () => {
  it("aplana las categorías de Regula (authenticity/dateChecks/...) en un único array con `category`", () => {
    const result = flattenRegulaAlerts({
      authenticity: [{ type: "MRZ", result: "OK" }],
      imageQuality: [{ type: "FOCUS", result: "WARN" }, { type: "GLARE", result: "OK" }],
    });
    expect(result).toEqual([
      { category: "authenticity", type: "MRZ", result: "OK" },
      { category: "imageQuality", type: "FOCUS", result: "WARN" },
      { category: "imageQuality", type: "GLARE", result: "OK" },
    ]);
  });

  it("ignora categorías ausentes o que no sean un array, sin fabricar entradas", () => {
    expect(flattenRegulaAlerts(undefined)).toEqual([]);
    expect(flattenRegulaAlerts({ authenticity: "no es un array" })).toEqual([]);
    expect(flattenRegulaAlerts({})).toEqual([]);
  });
});

describe("pickCaptureIdImage", () => {
  it("devuelve el string directo", () => {
    expect(pickCaptureIdImage("abc123")).toBe("abc123");
  });

  it("extrae el base64 anidado en varias formas tolerantes", () => {
    expect(pickCaptureIdImage({ data: "abc123" })).toBe("abc123");
    expect(pickCaptureIdImage({ image: { data: "abc123" } })).toBe("abc123");
    expect(pickCaptureIdImage({ base64: "abc123" })).toBe("abc123");
    expect(pickCaptureIdImage({ uri: "abc123" })).toBe("abc123");
  });

  it("retorna undefined cuando no encuentra ningún string utilizable, sin fabricar datos", () => {
    expect(pickCaptureIdImage(undefined)).toBeUndefined();
    expect(pickCaptureIdImage(null)).toBeUndefined();
    expect(pickCaptureIdImage({})).toBeUndefined();
    expect(pickCaptureIdImage({ foo: "bar" })).toBeUndefined();
  });
});

describe("buildCaptureIdOcr", () => {
  it("remapea data.ocr.fields (key/value) a los mismos nombres camelCase que usa Acuant", () => {
    const result = buildCaptureIdOcr({
      ocr: {
        fields: [
          { key: "Full Name", value: "CLIENTE DEMO" },
          { key: "Document Number", value: "0000000000" },
          { key: "Date of Expiry", value: "2030-01-01" },
        ],
      },
    });
    expect(result.fullName).toBe("CLIENTE DEMO");
    expect(result.documentNumber).toBe("0000000000");
    expect(result.expirationDate).toBe("2030-01-01");
  });

  it("prioriza decodeInfo.data.biograficos (QR de INE) por encima de los fields planos", () => {
    const result = buildCaptureIdOcr({
      ocr: {
        fields: [{ key: "Given Names", value: "DEL FIELD" }],
        decodeInfo: { data: { biograficos: { nombre: "DEL QR", curp: "CURP123" } } },
      },
    });
    expect(result.givenName).toBe("DEL QR");
    expect(result.curp).toBe("CURP123");
    expect(result.biograficos).toEqual({ nombre: "DEL QR", curp: "CURP123" });
  });

  it("no fabrica datos cuando no hay ocr: retorna los campos como undefined", () => {
    const result = buildCaptureIdOcr({});
    expect(result.fullName).toBeUndefined();
    expect(result.fields).toEqual([]);
  });
});

describe("toDataUri", () => {
  it("agrega el prefijo data URI a base64 crudo", () => {
    expect(toDataUri("abc123")).toBe("data:image/jpeg;base64,abc123");
  });

  it("no duplica el prefijo si ya viene como data URI", () => {
    expect(toDataUri("data:image/png;base64,abc123")).toBe("data:image/png;base64,abc123");
  });

  it("retorna undefined para valores vacíos", () => {
    expect(toDataUri(undefined)).toBeUndefined();
    expect(toDataUri(null)).toBeUndefined();
    expect(toDataUri("")).toBeUndefined();
  });
});

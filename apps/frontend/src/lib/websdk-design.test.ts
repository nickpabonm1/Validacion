import { describe, expect, it } from "vitest";
import {
  fontSizePx,
  isSixDigitHex,
  parseConfigurationJson,
  readFadCustomization,
  toFontSizeCss,
  writeFadCustomization,
} from "./websdk-design";

describe("parseConfigurationJson", () => {
  it("parsea un objeto JSON válido", () => {
    expect(parseConfigurationJson('{"a":1}')).toEqual({ a: 1 });
  });

  it("retorna {} para texto vacío, JSON inválido, o algo que no sea un objeto", () => {
    expect(parseConfigurationJson("")).toEqual({});
    expect(parseConfigurationJson("   ")).toEqual({});
    expect(parseConfigurationJson("{esto no es json")).toEqual({});
    expect(parseConfigurationJson("[1,2,3]")).toEqual({});
    expect(parseConfigurationJson("null")).toEqual({});
  });
});

describe("readFadCustomization / writeFadCustomization", () => {
  it("lee customization.fadCustomization anidado", () => {
    const configuration = { customization: { fadCustomization: { colors: { primary: "#A70635" } } } };
    expect(readFadCustomization(configuration)).toEqual({ colors: { primary: "#A70635" } });
  });

  it("retorna {} cuando no hay customization/fadCustomization, sin fabricar valores", () => {
    expect(readFadCustomization({})).toEqual({});
    expect(readFadCustomization({ customization: {} })).toEqual({});
  });

  it("preserva el resto de configuration/customization al escribir (leyendas, vistas, moduleCustomization)", () => {
    const original = JSON.stringify({
      views: { instructions: true },
      customization: {
        moduleCustomization: { legendsInstructions: { title: "Identificación" } },
        fadCustomization: { colors: { primary: "#000000" } },
      },
    });
    const updated = writeFadCustomization(original, { colors: { primary: "#A70635" } });
    const parsed = JSON.parse(updated);
    expect(parsed.views).toEqual({ instructions: true });
    expect(parsed.customization.moduleCustomization).toEqual({ legendsInstructions: { title: "Identificación" } });
    expect(parsed.customization.fadCustomization).toEqual({ colors: { primary: "#A70635" } });
  });

  it("parte de {} cuando el texto original está vacío o es inválido", () => {
    const updated = writeFadCustomization("", { colors: { primary: "#A70635" } });
    expect(JSON.parse(updated)).toEqual({ customization: { fadCustomization: { colors: { primary: "#A70635" } } } });
  });
});

describe("fontSizePx / toFontSizeCss", () => {
  it("convierte entre el string CSS ('25px') y el número en px", () => {
    expect(fontSizePx("25px")).toBe(25);
    expect(fontSizePx("17.5px")).toBe(17.5);
    expect(toFontSizeCss(25)).toBe("25px");
  });

  it("retorna undefined para valores ausentes o con formato no reconocido, sin fabricar un tamaño", () => {
    expect(fontSizePx(undefined)).toBeUndefined();
    expect(fontSizePx("grande")).toBeUndefined();
    expect(fontSizePx("25")).toBeUndefined(); // sin unidad "px" no se asume nada
    expect(toFontSizeCss(undefined)).toBeUndefined();
    expect(toFontSizeCss(Number.NaN)).toBeUndefined();
  });
});

describe("isSixDigitHex", () => {
  it("acepta hex de 6 dígitos con #", () => {
    expect(isSixDigitHex("#A70635")).toBe(true);
    expect(isSixDigitHex("#ffffff")).toBe(true);
  });

  it("rechaza hex de 8 dígitos (con alpha), sin # o valores no-hex, sin truncarlos", () => {
    expect(isSixDigitHex("#2b2b2b66")).toBe(false);
    expect(isSixDigitHex("A70635")).toBe(false);
    expect(isSixDigitHex("rojo")).toBe(false);
    expect(isSixDigitHex(undefined)).toBe(false);
  });
});

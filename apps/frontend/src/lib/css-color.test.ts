import { describe, expect, it } from "vitest";
import { toHexColor } from "./css-color";

describe("toHexColor", () => {
  it("normaliza hex de 3 y 6 dígitos a minúsculas de 6 dígitos", () => {
    expect(toHexColor("#FFF")).toBe("#ffffff");
    expect(toHexColor("#005b95")).toBe("#005b95");
    expect(toHexColor("#005B95")).toBe("#005b95");
  });

  it("convierte rgb()/rgba() a hex", () => {
    expect(toHexColor("rgb(0, 91, 149)")).toBe("#005b95");
    expect(toHexColor("rgba(0, 91, 149, 0.5)")).toBe("#005b95");
  });

  it("convierte hsl()/hsla() a hex", () => {
    expect(toHexColor("hsl(0, 100%, 50%)")).toBe("#ff0000");
    expect(toHexColor("hsla(0, 100%, 50%, 0.5)")).toBe("#ff0000");
  });

  it("retorna null para valores que no son colores", () => {
    expect(toHexColor("15px")).toBeNull();
    expect(toHexColor("1rem")).toBeNull();
    expect(toHexColor("")).toBeNull();
  });
});

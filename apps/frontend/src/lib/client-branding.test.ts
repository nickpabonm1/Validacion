import { describe, expect, it } from "vitest";
import { hexToHslTriplet } from "./client-branding";

describe("hexToHslTriplet", () => {
  it("convierte hex conocidos a su triplete HSL", () => {
    expect(hexToHslTriplet("#ff0000")).toBe("0 100% 50%");
    expect(hexToHslTriplet("#000000")).toBe("0 0% 0%");
    expect(hexToHslTriplet("#ffffff")).toBe("0 0% 100%");
  });

  it("devuelve null para un valor que no es un hex de 6 dígitos", () => {
    expect(hexToHslTriplet("not-a-color")).toBeNull();
    expect(hexToHslTriplet("#fff")).toBeNull();
  });
});

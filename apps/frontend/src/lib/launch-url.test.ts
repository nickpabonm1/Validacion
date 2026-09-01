import { describe, expect, it } from "vitest";
import { buildLaunchUrl } from "./launch-url";

describe("buildLaunchUrl", () => {
  it("retorna null si no hay plantilla configurada", () => {
    expect(buildLaunchUrl(null, "vid-1", {})).toBeNull();
    expect(buildLaunchUrl(undefined, "vid-1", {})).toBeNull();
    expect(buildLaunchUrl("", "vid-1", {})).toBeNull();
  });

  it("sustituye {validationId} cuando la plantilla no requiere key/vector", () => {
    const url = buildLaunchUrl("https://fad.example.com/process/{validationId}", "vid-1", {});
    expect(url).toBe("https://fad.example.com/process/vid-1");
  });

  it("retorna null si la plantilla requiere key y todavía no ha sido revelada", () => {
    const url = buildLaunchUrl("https://fad.example.com/process/{validationId}?key={key}", "vid-1", {});
    expect(url).toBeNull();
  });

  it("retorna null si la plantilla requiere vector y todavía no ha sido revelado", () => {
    const url = buildLaunchUrl("https://fad.example.com/process/{validationId}?vector={vector}", "vid-1", { key: "k1" });
    expect(url).toBeNull();
  });

  it("sustituye validationId, key y vector una vez revelados", () => {
    const url = buildLaunchUrl(
      "https://fad.example.com/process/{validationId}?key={key}&vector={vector}",
      "vid-1",
      { key: "k1", vector: "v1" },
    );
    expect(url).toBe("https://fad.example.com/process/vid-1?key=k1&vector=v1");
  });
});

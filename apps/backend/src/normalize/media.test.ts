import { describe, expect, it } from "vitest";
import { extractMediaAssets } from "./media";
import type { NormalizedStep } from "@fad-console/shared-types";

function step(key: string, data: unknown): NormalizedStep {
  return {
    key,
    label: key,
    order: 1,
    show: true,
    status: "COMPLETED",
    rawStatus: "COMPLETED",
    configuration: {},
    features: {},
    data,
    startedAt: null,
    completedAt: null,
    durationSeconds: null,
  };
}

const FAKE_BASE64 = "A".repeat(250);

describe("extractMediaAssets", () => {
  it("extrae imágenes de la estructura files[] del SDK (captureId)", () => {
    const steps = [
      step("captureId", {
        classification: { countryCode: "COL" },
        files: [
          { name: "image_id_front", file: FAKE_BASE64, type: "png" },
          { name: "image_id_back", file: FAKE_BASE64, type: "jpeg" },
        ],
      }),
    ];
    const assets = extractMediaAssets(steps);
    expect(assets).toHaveLength(2);
    expect(assets[0]!.label).toBe("image_id_front");
    expect(assets[0]!.mimeType).toBe("image/png");
    expect(assets[0]!.dataUrl.startsWith("data:image/png;base64,")).toBe(true);
  });

  it("omite formatos no renderizables como imagen (wsq, video)", () => {
    const steps = [
      step("fingerprints", {
        hand: {
          left: {
            index: {
              files: [
                { name: "e_finger_1", type: "wsq", file: FAKE_BASE64 },
                { name: "e_finger_1", type: "jpeg", file: FAKE_BASE64 },
              ],
            },
          },
        },
      }),
      step("idDetection", { files: [{ name: "video_id_detection", type: "mp4", file: FAKE_BASE64 }] }),
    ];
    const assets = extractMediaAssets(steps);
    expect(assets).toHaveLength(1);
    expect(assets[0]!.label).toBe("e_finger_1");
  });

  it("detecta campos sueltos tipo foto/face sin envoltura {name,file,type}", () => {
    const steps = [
      step("captureId", { descripcion: "OK", foto: FAKE_BASE64 }),
      step("authFace", { face: FAKE_BASE64 }),
    ];
    const assets = extractMediaAssets(steps);
    expect(assets.map((a) => a.label).sort()).toEqual(["face", "foto"]);
  });

  it("ignora valores cortos o que no son base64 válido (ej. IDs, nombres)", () => {
    const steps = [step("location", { validationId: "abc-123-def", name: "not-an-image" })];
    expect(extractMediaAssets(steps)).toHaveLength(0);
  });

  it("no lanza ante datos vacíos o nulos", () => {
    expect(extractMediaAssets([step("location", null), step("privacyNotice", undefined)])).toHaveLength(0);
  });
});

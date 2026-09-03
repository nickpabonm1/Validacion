import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../../lib/prisma";
import {
  getDocumentCheckScoringConfig,
  toDocumentCheckScoringConfigDto,
  upsertDocumentCheckScoringConfig,
} from "./document-check-scoring.service";

describe("document-check-scoring.service: configuración global de pesos/umbral", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("crea la fila singleton con valores por defecto en el primer acceso (sin pesos, sin umbral)", async () => {
    await prisma.documentCheckScoringConfig.deleteMany();
    const config = await getDocumentCheckScoringConfig();
    expect(config.id).toBe("singleton");
    expect(config.passThreshold).toBeNull();

    const dto = toDocumentCheckScoringConfigDto(config);
    expect(dto.categoryWeights).toEqual({});
    expect(dto.passThreshold).toBeNull();
  });

  it("guarda pesos por categoría y un umbral, y los recupera tal cual", async () => {
    await prisma.documentCheckScoringConfig.deleteMany();
    await upsertDocumentCheckScoringConfig({
      categoryWeights: { authenticity: 3, imageQuality: 1, textCrossChecks: 2 },
      passThreshold: 85,
    });

    const config = await getDocumentCheckScoringConfig();
    const dto = toDocumentCheckScoringConfigDto(config);
    expect(dto.categoryWeights).toEqual({ authenticity: 3, imageQuality: 1, textCrossChecks: 2 });
    expect(dto.passThreshold).toBe(85);
  });

  it("permite volver a quitar el umbral (null) en una edición posterior", async () => {
    await prisma.documentCheckScoringConfig.deleteMany();
    await upsertDocumentCheckScoringConfig({ categoryWeights: { authenticity: 3 }, passThreshold: 85 });
    await upsertDocumentCheckScoringConfig({ categoryWeights: { authenticity: 3 }, passThreshold: null });

    const dto = toDocumentCheckScoringConfigDto(await getDocumentCheckScoringConfig());
    expect(dto.passThreshold).toBeNull();
  });
});

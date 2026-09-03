import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../../lib/prisma";
import { toJsonField } from "../../lib/json-field";
import {
  getDocumentCheckScoringConfig,
  listKnownDocumentCheckFeatures,
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
      featureWeights: {},
      passThreshold: 85,
      treatNotDoneAsFailure: false,
    });

    const config = await getDocumentCheckScoringConfig();
    const dto = toDocumentCheckScoringConfigDto(config);
    expect(dto.categoryWeights).toEqual({ authenticity: 3, imageQuality: 1, textCrossChecks: 2 });
    expect(dto.passThreshold).toBe(85);
  });

  it("permite volver a quitar el umbral (null) en una edición posterior", async () => {
    await prisma.documentCheckScoringConfig.deleteMany();
    await upsertDocumentCheckScoringConfig({
      categoryWeights: { authenticity: 3 },
      featureWeights: {},
      passThreshold: 85,
      treatNotDoneAsFailure: false,
    });
    await upsertDocumentCheckScoringConfig({
      categoryWeights: { authenticity: 3 },
      featureWeights: {},
      passThreshold: null,
      treatNotDoneAsFailure: false,
    });

    const dto = toDocumentCheckScoringConfigDto(await getDocumentCheckScoringConfig());
    expect(dto.passThreshold).toBeNull();
  });

  it("guarda subpesos por característica dentro de cada categoría, y los recupera tal cual", async () => {
    await prisma.documentCheckScoringConfig.deleteMany();
    await upsertDocumentCheckScoringConfig({
      categoryWeights: { authenticity: 100 },
      featureWeights: { authenticity: { hologram: 60, microprint: 40 } },
      passThreshold: null,
      treatNotDoneAsFailure: false,
    });

    const dto = toDocumentCheckScoringConfigDto(await getDocumentCheckScoringConfig());
    expect(dto.featureWeights).toEqual({ authenticity: { hologram: 60, microprint: 40 } });
  });

  it("una configuración sin featureWeights (creada antes de que existiera esta característica) se lee como objeto vacío, nunca null", async () => {
    await prisma.documentCheckScoringConfig.deleteMany();
    // Simula una fila creada antes de la migración que agregó `featureWeights` (columna con su
    // valor por defecto "{}", nunca NULL — pero se prueba explícitamente para no asumirlo).
    await upsertDocumentCheckScoringConfig({
      categoryWeights: { authenticity: 100 },
      featureWeights: {},
      passThreshold: null,
      treatNotDoneAsFailure: false,
    });
    const dto = toDocumentCheckScoringConfigDto(await getDocumentCheckScoringConfig());
    expect(dto.featureWeights).toEqual({});
  });
});

describe("listKnownDocumentCheckFeatures: sugerencias de nombres de característica ya observados", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("agrupa por categoría los nombres distintos de documentChecks vistos en ejecuciones reales", async () => {
    await prisma.validationExecution.deleteMany();
    await prisma.apiEnvironment.deleteMany();

    const environment = await prisma.apiEnvironment.create({
      data: { name: "Env known-features", environmentType: "UATHA", baseUrl: "https://fad.test.invalid" },
    });

    async function createExecutionWithChecks(documentChecks: Array<{ category: string; name: string }>) {
      await prisma.validationExecution.create({
        data: {
          processName: "Prueba known-features",
          environmentId: environment.id,
          requestPayload: "{}",
          normalizedResponse: toJsonField({
            documentChecks: documentChecks.map((c) => ({
              category: c.category,
              name: c.name,
              page: null,
              description: null,
              result: "OK",
              resultDescription: null,
              sources: null,
            })),
          }),
          clientNameMasked: "P*****",
          clientEmailMasked: "c****@example.com",
          isDemo: false,
        },
      });
    }

    await createExecutionWithChecks([
      { category: "authenticity", name: "hologram" },
      { category: "authenticity", name: "microprint" },
      { category: "imageQuality", name: "sharpness" },
    ]);
    await createExecutionWithChecks([
      { category: "authenticity", name: "hologram" }, // repetido — no debe duplicarse
      { category: "dateChecks", name: "expiration_date" },
    ]);

    const knownFeatures = await listKnownDocumentCheckFeatures();
    expect(knownFeatures.authenticity).toEqual(["hologram", "microprint"]);
    expect(knownFeatures.imageQuality).toEqual(["sharpness"]);
    expect(knownFeatures.dateChecks).toEqual(["expiration_date"]);
  });
});

import type { DocumentCheckScoringConfigDto } from "@fad-console/shared-types";
import type { DocumentCheckScoringConfigInput } from "@fad-console/validation-schemas";
import { prisma } from "../../lib/prisma";
import { fromJsonField, toJsonField } from "../../lib/json-field";

const SINGLETON_ID = "singleton";

type DocumentCheckScoringConfigRecord = Awaited<ReturnType<typeof prisma.documentCheckScoringConfig.upsert>>;

export function toDocumentCheckScoringConfigDto(config: DocumentCheckScoringConfigRecord): DocumentCheckScoringConfigDto {
  return {
    categoryWeights: fromJsonField<Record<string, number>>(config.categoryWeights, {}),
    passThreshold: config.passThreshold,
    updatedAt: config.updatedAt.toISOString(),
  };
}

/** Crea la fila singleton con valores por defecto (sin pesos configurados = todas las
 * categorías pesan 1, sin umbral = el reporte solo muestra el porcentaje) si aún no existe. */
export async function getDocumentCheckScoringConfig() {
  return prisma.documentCheckScoringConfig.upsert({
    where: { id: SINGLETON_ID },
    update: {},
    create: { id: SINGLETON_ID },
  });
}

export async function upsertDocumentCheckScoringConfig(input: DocumentCheckScoringConfigInput) {
  const data = {
    categoryWeights: toJsonField(input.categoryWeights),
    passThreshold: input.passThreshold,
  };
  return prisma.documentCheckScoringConfig.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID, ...data },
    update: data,
  });
}

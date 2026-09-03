import type { DocumentCheckScoringConfigDto, NormalizedValidationDetail } from "@fad-console/shared-types";
import type { DocumentCheckScoringConfigInput } from "@fad-console/validation-schemas";
import { prisma } from "../../lib/prisma";
import { fromJsonField, toJsonField } from "../../lib/json-field";

/** Cuántas de las ejecuciones más recientes con detalle normalizado se revisan para sugerir
 * nombres de características ya observados — no hace falta exhaustividad (es una ayuda para
 * escribir el nombre exacto al configurar subpesos, no una fuente de verdad), así que se acota
 * por rendimiento. */
const KNOWN_FEATURES_SAMPLE_SIZE = 300;

const SINGLETON_ID = "singleton";

type DocumentCheckScoringConfigRecord = Awaited<ReturnType<typeof prisma.documentCheckScoringConfig.upsert>>;

export function toDocumentCheckScoringConfigDto(config: DocumentCheckScoringConfigRecord): DocumentCheckScoringConfigDto {
  return {
    categoryWeights: fromJsonField<Record<string, number>>(config.categoryWeights, {}),
    featureWeights: fromJsonField<Record<string, Record<string, number>>>(config.featureWeights, {}),
    passThreshold: config.passThreshold,
    treatNotDoneAsFailure: config.treatNotDoneAsFailure,
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
    featureWeights: toJsonField(input.featureWeights ?? {}),
    passThreshold: input.passThreshold,
    treatNotDoneAsFailure: input.treatNotDoneAsFailure,
  };
  return prisma.documentCheckScoringConfig.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID, ...data },
    update: data,
  });
}

/** Nombres de característica (`documentChecks[].name`) realmente observados en ejecuciones
 * recientes, agrupados por categoría — para sugerir al configurar subpesos por característica en
 * vez de que el operador tenga que adivinar/copiar el nombre exacto que devuelve cada proveedor. */
export async function listKnownDocumentCheckFeatures(): Promise<Record<string, string[]>> {
  const executions = await prisma.validationExecution.findMany({
    where: { normalizedResponse: { not: null } },
    select: { normalizedResponse: true },
    orderBy: { createdAt: "desc" },
    take: KNOWN_FEATURES_SAMPLE_SIZE,
  });

  const byCategory = new Map<string, Set<string>>();
  for (const execution of executions) {
    const detail = fromJsonField<Partial<NormalizedValidationDetail> | null>(execution.normalizedResponse, null);
    for (const check of detail?.documentChecks ?? []) {
      const names = byCategory.get(check.category) ?? new Set<string>();
      names.add(check.name);
      byCategory.set(check.category, names);
    }
  }

  return Object.fromEntries([...byCategory.entries()].map(([category, names]) => [category, [...names].sort()]));
}

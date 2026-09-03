/**
 * Configuración de puntuación de `documentChecks` (Validación de ID del paso `captureId`): peso
 * relativo por categoría y umbral de aprobación. Es una decisión de negocio del operador, nunca
 * algo que FAD indique — por eso es configurable en vez de estar codificado (ver
 * `document-check-scoring` en el backend y `document-check-score.ts` en el frontend).
 */
export interface DocumentCheckScoringConfigDto {
  /** Peso por categoría (`textCrossChecks`, `imageQuality`, `mrzCheckDigit`, `dateChecks`,
   * `authenticity`, `documentValidation`). Una categoría ausente pesa 1 (peso neutro). */
  categoryWeights: Record<string, number>;
  /** Porcentaje mínimo (0-100) para considerar la validación de documento "aprobada". `null` =
   * sin umbral configurado — el reporte solo muestra el porcentaje, sin veredicto. */
  passThreshold: number | null;
  updatedAt: string;
}

/** Resultado de puntuar `documentChecks` con un `DocumentCheckScoringConfigDto`. Los checks con
 * resultado "WAS_NOT_DONE" (no evaluados por FAD) se excluyen tanto del numerador como del
 * denominador — nunca se asume que "no evaluado" equivalga a correcto o incorrecto. */
export interface DocumentCheckScore {
  totalWeight: number;
  achievedWeight: number;
  percentage: number | null;
  evaluatedCount: number;
  skippedCount: number;
  passed: boolean | null;
  byCategory: Array<{
    category: string;
    totalWeight: number;
    achievedWeight: number;
    percentage: number | null;
  }>;
}

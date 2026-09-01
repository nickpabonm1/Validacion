import type { FieldRenderType, SensitivityLevel } from "./enums";

/** Grupos sugeridos por el Diseñador de vista de respuesta (sección 16 del brief). */
export const RESPONSE_FIELD_GROUPS = [
  "Resumen",
  "Estado del proceso",
  "Cliente",
  "Documento",
  "Datos OCR",
  "Clasificación",
  "Alertas",
  "Biometría",
  "Comparación facial",
  "Dispositivo",
  "Red",
  "Geolocalización",
  "Archivos",
  "Validaciones externas",
  "Información técnica",
] as const;
export type ResponseFieldGroup = (typeof RESPONSE_FIELD_GROUPS)[number];

export interface ResponseFieldCondition {
  path: string;
  operator: "eq" | "neq" | "exists" | "notExists" | "truthy" | "falsy";
  value?: string | number | boolean;
}

/** Configuración de un campo dentro de una vista de respuesta. Sin `eval`: `renderType` es la
 * única forma de transformación, tomada de una lista cerrada de transformaciones conocidas. */
export interface ResponseFieldConfig {
  id: string;
  /** Ruta tipo `data.client.nombre` sobre el JSON normalizado de la validación. */
  path: string;
  label: string;
  description?: string;
  group: ResponseFieldGroup | string;
  order: number;
  visible: boolean;
  showOnlyIfHasValue: boolean;
  condition?: ResponseFieldCondition;
  renderType: FieldRenderType;
  dateFormat?: string;
  numberFormat?: string;
  unit?: string;
  badgeColorMap?: Record<string, "success" | "warning" | "error" | "info" | "neutral">;
  sensitivity: SensitivityLevel;
  requiredRole?: "ADMIN" | "OPERATOR" | "AUDITOR";
  defaultValue?: string;
}

export interface ResponseViewConfig {
  fields: ResponseFieldConfig[];
}

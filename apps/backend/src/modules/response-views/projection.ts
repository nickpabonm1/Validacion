import type { FieldRenderType, UserRole } from "@fad-console/shared-types";
import type { ResponseFieldConfigInput } from "@fad-console/validation-schemas";
import { maskGeneric } from "../../normalize/mask";

export interface ResponseViewConfigShape {
  fields: ResponseFieldConfigInput[];
}

export interface RenderedField {
  id: string;
  path: string;
  label: string;
  description?: string;
  group: string;
  order: number;
  renderType: FieldRenderType;
  value: unknown;
  masked: boolean;
}

function getByPath(source: unknown, path: string): unknown {
  const segments = path.split(".").filter(Boolean);
  let current: unknown = source;
  for (const segment of segments) {
    if (current === null || current === undefined) return undefined;
    if (Array.isArray(current)) {
      const index = Number(segment);
      current = Number.isInteger(index) ? current[index] : undefined;
    } else if (typeof current === "object") {
      current = (current as Record<string, unknown>)[segment];
    } else {
      return undefined;
    }
  }
  return current;
}

/** ADMIN siempre puede ver todo; para otros roles el campo debe coincidir exactamente con el
 * rol requerido (o no tener rol requerido). Esto es una restricción de PERMISO (el campo se
 * omite por completo), distinta del enmascaramiento por sensibilidad. */
function roleSatisfies(viewerRole: UserRole, requiredRole?: UserRole): boolean {
  if (!requiredRole) return true;
  if (viewerRole === "ADMIN") return true;
  return viewerRole === requiredRole;
}

function evaluateCondition(source: unknown, condition: ResponseFieldConfigInput["condition"]): boolean {
  if (!condition) return true;
  const value = getByPath(source, condition.path);
  switch (condition.operator) {
    case "eq":
      return value === condition.value;
    case "neq":
      return value !== condition.value;
    case "exists":
      return value !== undefined && value !== null;
    case "notExists":
      return value === undefined || value === null;
    case "truthy":
      return Boolean(value);
    case "falsy":
      return !value;
    default:
      return true;
  }
}

/**
 * Motor de proyección seguro del Diseñador de vista de respuesta: NUNCA usa `eval`. Resuelve
 * rutas tipo `client.nameMasked` sobre el objeto normalizado, filtra por permisos/condición y
 * aplica enmascaramiento cuando la sensibilidad del campo o su tipo de renderizado lo exige.
 * Todas las demás transformaciones (fecha, número, badge, etc.) son puramente descriptivas —
 * `renderType` — y se materializan en el frontend a partir de una lista cerrada de
 * transformaciones conocidas.
 */
export function projectResponseView(
  detail: unknown,
  config: ResponseViewConfigShape,
  viewerRole: UserRole,
): RenderedField[] {
  const results: RenderedField[] = [];

  for (const field of config.fields) {
    if (!field.visible) continue;
    if (!roleSatisfies(viewerRole, field.requiredRole)) continue;

    const rawValue = getByPath(detail, field.path);
    const isEmpty = rawValue === undefined || rawValue === null || rawValue === "";
    if (field.showOnlyIfHasValue && isEmpty) continue;
    if (!evaluateCondition(detail, field.condition)) continue;

    const shouldMask = field.sensitivity === "SECRET" || field.renderType === "MASKED";
    const resolved = isEmpty ? (field.defaultValue ?? null) : rawValue;
    const value = shouldMask && typeof resolved === "string" ? maskGeneric(resolved) : resolved;

    results.push({
      id: field.id,
      path: field.path,
      label: field.label,
      description: field.description,
      group: field.group,
      order: field.order,
      renderType: field.renderType,
      value,
      masked: shouldMask,
    });
  }

  return results.sort((a, b) => a.order - b.order);
}

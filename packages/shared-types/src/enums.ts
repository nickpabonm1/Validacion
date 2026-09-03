/** LAUNCHER: rol restringido de "solo enviar procesos" — puede crear ejecuciones (API-by-steps o
 * Web SDK) y ver su resultado, pero no tiene acceso a ninguna pantalla de configuración
 * (Ambientes, Plantillas, Constructor, Webhooks, Catálogos, Usuarios, Auditoría, Configuración). */
export const USER_ROLES = ["ADMIN", "OPERATOR", "AUDITOR", "LAUNCHER"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ENVIRONMENT_TYPES = ["UATHA", "QA", "PRODUCTION"] as const;
export type EnvironmentType = (typeof ENVIRONMENT_TYPES)[number];

/**
 * Motor de base de datos que esta instancia usa o planea usar (pestaña "Base de datos" del menú).
 * SQLITE y POSTGRESQL son los únicos con soporte funcional real (ambos vía Prisma+SQL — ver
 * `prisma/schema.prisma` y `prisma/postgresql/schema.prisma`, generado con
 * `scripts/build-postgresql-schema.mjs`). MONGODB y GRAPH_NEO4J se pueden seleccionar y guardar
 * como preferencia/datos de conexión, pero no tienen una capa de acceso a datos implementada
 * todavía — requerirían un modelo de datos y un cliente distintos a Prisma+SQL, no un simple
 * cambio de `DATABASE_URL`. Nunca se presenta como "funcionando" cuando no lo está.
 */
export const DATABASE_ENGINES = ["SQLITE", "POSTGRESQL", "MONGODB", "GRAPH_NEO4J"] as const;
export type DatabaseEngine = (typeof DATABASE_ENGINES)[number];

/** Motores con soporte funcional real hoy (Prisma + SQL) — los únicos para los que "Probar
 * conexión" hace un intento de conexión real. */
export const FUNCTIONAL_DATABASE_ENGINES: readonly DatabaseEngine[] = ["SQLITE", "POSTGRESQL"];

export const HTTP_METHODS = ["GET", "POST"] as const;
export type ConfigurableHttpMethod = (typeof HTTP_METHODS)[number];

/**
 * Modelo de integración de un ambiente (ver docs/technical-analysis.md — "Selección del Modelo
 * de Integración"). API_BY_STEPS es el modelo original: FAD aloja el proceso y esta consola solo
 * lo configura/monitorea. WEB_SDK habilita captura embebida (Acuant + Facetec) en el navegador,
 * orquestada por esta consola — ver docs/websdk-integration.md.
 */
export const INTEGRATION_MODELS = ["API_BY_STEPS", "WEB_SDK"] as const;
export type IntegrationModel = (typeof INTEGRATION_MODELS)[number];

/** Motor de captura documental para el modelo Web SDK — ver docs/websdk-integration.md.
 * CAPTURE_ID es `startCaptureId()` (ver "FAD SDK Web CaptureId"): a diferencia de Acuant/Regula
 * no recibe credenciales por parámetro — se autentica con el `sdkToken` ya existente. */
export const DOCUMENT_CAPTURE_ENGINES = ["ACUANT", "REGULA", "CAPTURE_ID"] as const;
export type DocumentCaptureEngine = (typeof DOCUMENT_CAPTURE_ENGINES)[number];

/** CaptureType de `startRegula()`: DOCUMENT_READER (automático) | CAMERA_SNAPSHOT (manual).
 * El PDF "FAD SDK Web Regula" §Initiate the Process también documenta un tercer valor `DESKTOP`
 * (carga de archivo), pero el enum `RegulaCaptureType` del paquete instalado
 * `@fad-producto/fad-sdk` (ver node_modules/@fad-producto/fad-sdk/dist/types/constants/regula/
 * card-type/regula-capture-type.enum.d.ts) solo define estos dos — se sigue el paquete real
 * instalado, no la prosa del PDF, porque es lo que efectivamente se ejecuta en el navegador. */
export const REGULA_CAPTURE_TYPES = ["DOCUMENT_READER", "CAMERA_SNAPSHOT"] as const;
export type RegulaCaptureType = (typeof REGULA_CAPTURE_TYPES)[number];

/** Motor de prueba de vida para el modelo Web SDK. Solo Facetec está implementado. */
export const BIOMETRIC_ENGINES = ["FACETEC"] as const;
export type BiometricEngine = (typeof BIOMETRIC_ENGINES)[number];

/** Nivel de riesgo devuelto por el servicio NAAT-CHECK. */
export const RISK_LEVELS = ["LOW", "MEDIUM", "HIGH"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

/**
 * Estado normalizado interno. El valor original de FAD (español/inglés, variable según
 * endpoint) siempre se preserva en `rawStatus`.
 */
export const NORMALIZED_VALIDATION_STATUSES = [
  "CREATED",
  "IN_PROGRESS",
  "COMPLETED",
  "FAILED",
  "EXPIRED",
  "CANCELLED",
  "UNKNOWN",
] as const;
export type NormalizedValidationStatus = (typeof NORMALIZED_VALIDATION_STATUSES)[number];

export const NORMALIZED_STEP_STATUSES = [
  "PENDING",
  "IN_PROGRESS",
  "COMPLETED",
  "FAILED",
  "SKIPPED",
  "UNKNOWN",
] as const;
export type NormalizedStepStatus = (typeof NORMALIZED_STEP_STATUSES)[number];

export const NORMALIZED_RESULTS = ["APPROVED", "REJECTED", "UNKNOWN"] as const;
export type NormalizedResult = (typeof NORMALIZED_RESULTS)[number];

export const WEBHOOK_PROCESSING_STATUSES = [
  "RECEIVED",
  "PROCESSED",
  "DUPLICATE",
  "UNKNOWN_EVENT",
  "ERROR",
] as const;
export type WebhookProcessingStatus = (typeof WEBHOOK_PROCESSING_STATUSES)[number];

export const SENSITIVITY_LEVELS = ["PUBLIC", "INTERNAL", "SENSITIVE", "SECRET"] as const;
export type SensitivityLevel = (typeof SENSITIVITY_LEVELS)[number];

export const RESPONSE_VIEW_KINDS = ["EXECUTIVE", "OPERATIVE", "TECHNICAL", "CUSTOM"] as const;
export type ResponseViewKind = (typeof RESPONSE_VIEW_KINDS)[number];

export const FIELD_RENDER_TYPES = [
  "TEXT",
  "NUMBER",
  "PERCENTAGE",
  "DATE",
  "DATETIME",
  "BOOLEAN",
  "STATUS",
  "BADGE",
  "LIST",
  "TABLE",
  "JSON",
  "IMAGE",
  "LINK",
  "COORDINATES",
  "MASKED",
  "DOCUMENT_CHECKS",
] as const;
export type FieldRenderType = (typeof FIELD_RENDER_TYPES)[number];

export const AUDIT_ACTIONS = [
  "LOGIN",
  "LOGIN_FAILED",
  "LOGOUT",
  "CREATE",
  "UPDATE",
  "DELETE",
  "REVEAL_SECRET",
  "TEST_CONNECTION",
  "EXECUTE_VALIDATION",
  "QUERY_VALIDATION",
  "WEBHOOK_RECEIVED",
  "EXPORT",
  "SHARE_LINK_SENT",
  "PASSWORD_RESET_REQUESTED",
  "PASSWORD_RESET_COMPLETED",
  "ADMIN_PASSWORD_RESET",
  "NAAT_CHECK_RECHECK_REQUESTED",
  "NAAT_CHECK_RECHECK_COMPLETED",
  "NAAT_CHECK_RECHECK_FAILED",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

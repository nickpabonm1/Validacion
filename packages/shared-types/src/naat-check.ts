import type { RiskLevel } from "./enums";

/**
 * Configuración de NAAT-CHECK (NAAT.TECH "API RECHECK PROCESS") por ambiente — un servicio
 * EXTERNO a FAD que reevalúa el riesgo de un documento ya capturado bajo pedido. Ver
 * `NaatCheckConfig` en prisma/schema.prisma para la distinción frente a `naatCheckResult`
 * (pasivo, lo devuelve FAD) y el NAAT-CHECK del flujo Web SDK.
 */
export interface NaatCheckConfigDto {
  environmentId: string;
  enabled: boolean;
  baseUrl: string;
  username: string | null;
  passwordConfigured: boolean;
  acceptedRiskLevel: RiskLevel;
  webhookUsernameConfigured: boolean;
  webhookPasswordConfigured: boolean;
  updatedAt: string;
}

/** Resultado real de un recheck NAAT-CHECK (nunca fabricado — o viene de una respuesta genuina
 * del servicio, o la llamada lanza un error). `key`/`reasons` según la sección "data.key" del PDF
 * ("API RECHECK PROCESS" v1.1): motivo del riesgo cuando no es "ACCEPTED". */
export interface NaatCheckRecheckResultDto {
  risk: RiskLevel;
  key: string | null;
  result: boolean;
  requestedAt: string;
}

export interface NaatCheckTestConnectionResultDto {
  success: boolean;
  message: string;
}

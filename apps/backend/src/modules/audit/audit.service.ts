import type { AuditAction } from "@fad-console/shared-types";
import { prisma } from "../../lib/prisma";
import { toJsonField } from "../../lib/json-field";
import { redact } from "../../lib/redact";
import { logger } from "../../lib/logger";

export interface AuditContext {
  userId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

/**
 * Registra una entrada de auditoría. `metadata` se redacta antes de persistirse: nunca debe
 * llegar aquí un secreto o dato biométrico completo (ver docs/security-decisions.md). Un fallo
 * al escribir auditoría se registra en el log pero nunca interrumpe la operación principal.
 */
export async function logAudit(
  action: AuditAction,
  entityType: string | null,
  entityId: string | null,
  context: AuditContext,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: context.userId ?? null,
        action,
        entityType,
        entityId,
        metadata: metadata ? toJsonField(redact(metadata)) : null,
        ip: context.ip ?? null,
        userAgent: context.userAgent ?? null,
      },
    });
  } catch (error) {
    logger.error("No se pudo registrar auditoría", { action, entityType, entityId, error });
  }
}

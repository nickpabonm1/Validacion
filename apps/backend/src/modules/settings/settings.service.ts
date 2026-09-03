import { prisma } from "../../lib/prisma";
import { credentialEncryptionService } from "../credentials/credential-encryption.service";
import type { ClientScope } from "../clients/client-scope";

export async function listSettings() {
  const settings = await prisma.systemSetting.findMany({ orderBy: { key: "asc" } });
  return settings.map((s) => ({
    key: s.key,
    description: s.description,
    encrypted: s.encrypted,
    configured: Boolean(s.value),
    value: s.encrypted ? undefined : (s.value ?? undefined),
    updatedAt: s.updatedAt.toISOString(),
  }));
}

export async function upsertSetting(
  key: string,
  value: string,
  description: string | undefined,
  encrypted: boolean,
  userId: string | null,
) {
  const storedValue = encrypted ? credentialEncryptionService.encrypt(value) : value;
  return prisma.systemSetting.upsert({
    where: { key },
    update: { value: storedValue, description, encrypted, updatedById: userId },
    create: { key, value: storedValue, description, encrypted, updatedById: userId },
  });
}

export async function deleteSetting(key: string) {
  await prisma.systemSetting.deleteMany({ where: { key } });
}

export interface DashboardStats {
  totals: {
    validations: number;
    inProgress: number;
    completed: number;
    failed: number;
  };
  webhooks: {
    received: number;
    errors: number;
  };
  completionRatePercent: number;
  averageDurationSeconds: number | null;
  recentExecutions: Array<{
    id: string;
    processName: string;
    normalizedStatus: string;
    createdAt: string;
  }>;
  recentWebhookEvents: Array<{ id: string; eventType: string; receivedAt: string; processingStatus: string }>;
  environments: Array<{ id: string; name: string; connectionStatus: string }>;
}

export async function getDashboardStats(scope?: ClientScope): Promise<DashboardStats> {
  // Sin restricción (usuario de plataforma): comportamiento histórico, sin filtro. Con un
  // cliente asignado, cada consulta se limita a su subárbol — vía el ambiente al que pertenece
  // cada ejecución/evento de webhook (ninguno de los dos tiene `clientId` directo). Un webhook
  // aún no asociado a ninguna ejecución (`validationExecutionId: null`) no tiene forma de
  // atribuirse a un cliente, así que se excluye del panel de un cliente (nunca se muestra un
  // dato que no se pueda confirmar que le pertenece).
  const executionWhere = scope?.allowedIds ? { environment: { clientId: { in: scope.allowedIds } } } : {};
  const webhookWhere = scope?.allowedIds
    ? { validationExecution: { environment: { clientId: { in: scope.allowedIds } } } }
    : {};
  const environmentWhere = scope?.allowedIds ? { clientId: { in: scope.allowedIds } } : {};

  const [total, inProgress, completed, failed, webhooksReceived, webhooksError, recentExecutions, recentWebhookEvents, environments, completedExecutions] =
    await Promise.all([
      prisma.validationExecution.count({ where: executionWhere }),
      prisma.validationExecution.count({ where: { ...executionWhere, normalizedStatus: "IN_PROGRESS" } }),
      prisma.validationExecution.count({ where: { ...executionWhere, normalizedStatus: "COMPLETED" } }),
      prisma.validationExecution.count({ where: { ...executionWhere, normalizedStatus: "FAILED" } }),
      prisma.webhookEvent.count({ where: webhookWhere }),
      prisma.webhookEvent.count({ where: { ...webhookWhere, processingStatus: "ERROR" } }),
      prisma.validationExecution.findMany({ where: executionWhere, orderBy: { createdAt: "desc" }, take: 5 }),
      prisma.webhookEvent.findMany({ where: webhookWhere, orderBy: { receivedAt: "desc" }, take: 5 }),
      prisma.apiEnvironment.findMany({ where: environmentWhere }),
      prisma.validationExecution.findMany({
        where: { ...executionWhere, normalizedStatus: "COMPLETED", startedAt: { not: null }, completedAt: { not: null } },
        select: { startedAt: true, completedAt: true },
      }),
    ]);

  const durations = completedExecutions
    .filter((e) => e.startedAt && e.completedAt)
    .map((e) => (e.completedAt!.getTime() - e.startedAt!.getTime()) / 1000);
  const averageDurationSeconds =
    durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : null;

  return {
    totals: { validations: total, inProgress, completed, failed },
    webhooks: { received: webhooksReceived, errors: webhooksError },
    completionRatePercent: total > 0 ? Math.round((completed / total) * 100) : 0,
    averageDurationSeconds,
    recentExecutions: recentExecutions.map((e) => ({
      id: e.id,
      processName: e.processName,
      normalizedStatus: e.normalizedStatus,
      createdAt: e.createdAt.toISOString(),
    })),
    recentWebhookEvents: recentWebhookEvents.map((w) => ({
      id: w.id,
      eventType: w.eventType,
      receivedAt: w.receivedAt.toISOString(),
      processingStatus: w.processingStatus,
    })),
    environments: environments.map((e) => ({ id: e.id, name: e.name, connectionStatus: e.connectionStatus })),
  };
}

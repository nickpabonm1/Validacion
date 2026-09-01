import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api-client";

export interface DashboardStats {
  totals: { validations: number; inProgress: number; completed: number; failed: number };
  webhooks: { received: number; errors: number };
  completionRatePercent: number;
  averageDurationSeconds: number | null;
  recentExecutions: Array<{ id: string; processName: string; normalizedStatus: string; createdAt: string }>;
  recentWebhookEvents: Array<{ id: string; eventType: string; receivedAt: string; processingStatus: string }>;
  environments: Array<{ id: string; name: string; connectionStatus: string }>;
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ["settings", "dashboard"],
    queryFn: () => api.get<{ stats: DashboardStats }>("/settings/dashboard").then((r) => r.stats),
  });
}

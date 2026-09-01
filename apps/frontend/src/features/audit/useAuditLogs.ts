import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api-client";

export interface AuditLogDto {
  id: string;
  userId: string | null;
  userName: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  createdAt: string;
}

export function useAuditLogs(filters: { action?: string; entityType?: string }) {
  return useQuery({
    queryKey: ["audit", filters],
    queryFn: () => api.get<{ logs: AuditLogDto[] }>("/audit", filters as Record<string, string | undefined>).then((r) => r.logs),
  });
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ValidationExecutionListItemDto } from "@fad-console/shared-types";
import type { ValidationRequestConfig } from "@fad-console/validation-schemas";
import { api } from "../../lib/api-client";

export interface ExecutionStepDto {
  id: string;
  stepKey: string;
  order: number;
  show: boolean;
  status: string;
  configuration: Record<string, unknown>;
  features: Record<string, unknown>;
  data: unknown;
  startedAt: string | null;
  completedAt: string | null;
}

export interface ExecutionWebhookEventSummary {
  id: string;
  eventType: string;
  receivedAt: string;
  processingStatus: string;
  retry: number;
}

export interface ExecutionDetailDto {
  id: string;
  validationId: string | null;
  processName: string;
  environment: { id: string; name: string };
  template: { id: string; name: string } | null;
  normalizedStatus: string;
  rawStatus: string | null;
  result: string | null;
  isDemo: boolean;
  clientNameMasked: string;
  clientEmailMasked: string;
  keyMasked: string | null;
  vectorMasked: string | null;
  startedAt: string | null;
  completedAt: string | null;
  lastSyncedAt: string | null;
  createdAt: string;
  normalized: Record<string, unknown> | null;
  requestPayload: ValidationRequestConfig | null;
  steps: ExecutionStepDto[];
  webhookEvents: ExecutionWebhookEventSummary[];
}

export interface ExecutionFilters {
  status?: string;
  environmentId?: string;
  templateId?: string;
  search?: string;
}

export function useExecutionsList(filters: ExecutionFilters) {
  return useQuery({
    queryKey: ["executions", filters],
    queryFn: () =>
      api
        .get<{ executions: ValidationExecutionListItemDto[] }>("/executions", filters as Record<string, string | undefined>)
        .then((r) => r.executions),
  });
}

export function useExecutionDetail(id: string | undefined) {
  return useQuery({
    queryKey: ["executions", "detail", id],
    queryFn: () => api.get<{ execution: ExecutionDetailDto }>(`/executions/${id}`).then((r) => r.execution),
    enabled: Boolean(id),
  });
}

export interface ExecuteInput {
  environmentId: string;
  templateId?: string;
  requestConfig: ValidationRequestConfig;
}

export function useCreateExecution() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ExecuteInput) => api.post<{ execution: ExecutionDetailDto }>("/executions", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["executions"] }),
  });
}

export function useCreateDemoExecution() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ExecuteInput) => api.post<{ execution: ExecutionDetailDto }>("/executions/demo", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["executions"] }),
  });
}

export function useSyncExecution() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<{ execution: ExecutionDetailDto }>(`/executions/${id}/sync`),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ["executions"] });
      queryClient.invalidateQueries({ queryKey: ["executions", "detail", id] });
      queryClient.invalidateQueries({ queryKey: ["response-views", "apply"] });
    },
  });
}

export function useRevealSecret() {
  return useMutation({
    mutationFn: ({ id, field }: { id: string; field: "key" | "vector" }) =>
      api.post<{ value: string; masked: string }>(`/executions/${id}/reveal/${field}`),
  });
}

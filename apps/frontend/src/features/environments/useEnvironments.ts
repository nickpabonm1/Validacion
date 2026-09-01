import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ApiEnvironmentDto, TestConnectionResultDto } from "@fad-console/shared-types";
import type { ApiEnvironmentInput } from "@fad-console/validation-schemas";
import { api } from "../../lib/api-client";

export function useEnvironments() {
  return useQuery({
    queryKey: ["environments"],
    queryFn: () => api.get<{ environments: ApiEnvironmentDto[] }>("/environments").then((r) => r.environments),
  });
}

export function useCreateEnvironment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ApiEnvironmentInput) => api.post<{ environment: ApiEnvironmentDto }>("/environments", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["environments"] }),
  });
}

export function useUpdateEnvironment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ApiEnvironmentInput }) =>
      api.put<{ environment: ApiEnvironmentDto }>(`/environments/${id}`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["environments"] }),
  });
}

export function useDeleteEnvironment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/environments/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["environments"] }),
  });
}

export function useClearCredential() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, field }: { id: string; field: string }) =>
      api.delete<{ environment: ApiEnvironmentDto }>(`/environments/${id}/credentials/${field}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["environments"] }),
  });
}

export function useTestConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<TestConnectionResultDto>(`/environments/${id}/test-connection`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["environments"] }),
  });
}

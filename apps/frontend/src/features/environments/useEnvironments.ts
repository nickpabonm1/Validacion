import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ApiEnvironmentDto, TestConnectionResultDto, WebSdkConfigDto } from "@fad-console/shared-types";
import type { ApiEnvironmentInput, WebSdkConfigInput } from "@fad-console/validation-schemas";
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

export function useWebSdkConfig(environmentId: string | undefined) {
  return useQuery({
    queryKey: ["environments", environmentId, "websdk-config"],
    queryFn: () =>
      api
        .get<{ webSdkConfig: WebSdkConfigDto | null }>(`/environments/${environmentId}/websdk-config`)
        .then((r) => r.webSdkConfig),
    enabled: Boolean(environmentId),
  });
}

export function useUpdateWebSdkConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ environmentId, input }: { environmentId: string; input: WebSdkConfigInput }) =>
      api.put<{ webSdkConfig: WebSdkConfigDto }>(`/environments/${environmentId}/websdk-config`, input),
    onSuccess: (_data, { environmentId }) =>
      queryClient.invalidateQueries({ queryKey: ["environments", environmentId, "websdk-config"] }),
  });
}

export function useClearWebSdkCredential() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ environmentId, field }: { environmentId: string; field: string }) =>
      api.delete<{ webSdkConfig: WebSdkConfigDto }>(`/environments/${environmentId}/websdk-config/credentials/${field}`),
    onSuccess: (_data, { environmentId }) =>
      queryClient.invalidateQueries({ queryKey: ["environments", environmentId, "websdk-config"] }),
  });
}

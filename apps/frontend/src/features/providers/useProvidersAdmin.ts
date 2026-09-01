import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ProviderCatalogEntryInput } from "@fad-console/validation-schemas";
import type { ProviderCatalogEntryDto } from "@fad-console/shared-types";
import { api } from "../../lib/api-client";

export function useCreateProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ProviderCatalogEntryInput) => api.post<{ provider: ProviderCatalogEntryDto }>("/providers", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["providers"] }),
  });
}

export function useUpdateProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ProviderCatalogEntryInput }) =>
      api.put<{ provider: ProviderCatalogEntryDto }>(`/providers/${id}`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["providers"] }),
  });
}

export function useDeleteProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/providers/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["providers"] }),
  });
}

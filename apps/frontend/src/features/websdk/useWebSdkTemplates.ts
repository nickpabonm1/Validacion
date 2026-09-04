import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { WebSdkTemplateDto } from "@fad-console/shared-types";
import type { WebSdkTemplateInput } from "@fad-console/validation-schemas";
import { api } from "../../lib/api-client";

export function useWebSdkTemplates(environmentId: string | undefined) {
  return useQuery({
    queryKey: ["websdk-templates", environmentId],
    queryFn: () => api.get<{ templates: WebSdkTemplateDto[] }>("/websdk-templates", { environmentId }).then((r) => r.templates),
    enabled: Boolean(environmentId),
  });
}

export function useCreateWebSdkTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: WebSdkTemplateInput) => api.post<{ template: WebSdkTemplateDto }>("/websdk-templates", input),
    onSuccess: (data) => queryClient.invalidateQueries({ queryKey: ["websdk-templates", data.template.environmentId] }),
  });
}

export function useUpdateWebSdkTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: WebSdkTemplateInput }) =>
      api.put<{ template: WebSdkTemplateDto }>(`/websdk-templates/${id}`, input),
    onSuccess: (data) => queryClient.invalidateQueries({ queryKey: ["websdk-templates", data.template.environmentId] }),
  });
}

export function useDeleteWebSdkTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; environmentId: string }) => api.delete(`/websdk-templates/${id}`),
    onSuccess: (_data, { environmentId }) => queryClient.invalidateQueries({ queryKey: ["websdk-templates", environmentId] }),
  });
}

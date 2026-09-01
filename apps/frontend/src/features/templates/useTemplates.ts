import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ValidationRequestConfig } from "@fad-console/validation-schemas";
import { api } from "../../lib/api-client";

export interface TemplateDto {
  id: string;
  name: string;
  description: string | null;
  version: number;
  environmentId: string | null;
  requestConfig: ValidationRequestConfig;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export function useTemplates() {
  return useQuery({
    queryKey: ["templates"],
    queryFn: () => api.get<{ templates: TemplateDto[] }>("/templates").then((r) => r.templates),
  });
}

export function useTemplate(id: string | undefined) {
  return useQuery({
    queryKey: ["templates", id],
    queryFn: () => api.get<{ template: TemplateDto }>(`/templates/${id}`).then((r) => r.template),
    enabled: Boolean(id),
  });
}

export interface TemplateInput {
  name: string;
  description?: string;
  environmentId?: string | null;
  requestConfig: ValidationRequestConfig;
  active: boolean;
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TemplateInput) => api.post<{ template: TemplateDto }>("/templates", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["templates"] }),
  });
}

export function useUpdateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: TemplateInput }) =>
      api.put<{ template: TemplateDto }>(`/templates/${id}`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["templates"] }),
  });
}

export function useCloneTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post<{ template: TemplateDto }>(`/templates/${id}/clone`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["templates"] }),
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/templates/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["templates"] }),
  });
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api-client";

export interface ResponseFieldConfigDto {
  id: string;
  path: string;
  label: string;
  description?: string;
  group: string;
  order: number;
  visible: boolean;
  showOnlyIfHasValue: boolean;
  condition?: { path: string; operator: string; value?: string | number | boolean };
  renderType: string;
  dateFormat?: string;
  numberFormat?: string;
  unit?: string;
  badgeColorMap?: Record<string, string>;
  documentCheckCategories?: string[];
  sensitivity: string;
  requiredRole?: string;
  defaultValue?: string;
}

export interface ResponseViewDto {
  id: string;
  name: string;
  description: string | null;
  kind: string;
  templateId: string | null;
  isDefault: boolean;
  configuration: { fields: ResponseFieldConfigDto[] };
  createdAt: string;
  updatedAt: string;
}

export interface RenderedField {
  id: string;
  path: string;
  label: string;
  description?: string;
  group: string;
  order: number;
  renderType: string;
  value: unknown;
  masked: boolean;
}

export function useResponseViews() {
  return useQuery({
    queryKey: ["response-views"],
    queryFn: () => api.get<{ views: ResponseViewDto[] }>("/response-views").then((r) => r.views),
  });
}

export function useApplyResponseView(viewId: string | undefined, executionId: string | undefined) {
  return useQuery({
    queryKey: ["response-views", "apply", viewId, executionId],
    queryFn: () => api.get<{ fields: RenderedField[] }>(`/response-views/${viewId}/apply/${executionId}`).then((r) => r.fields),
    enabled: Boolean(viewId && executionId),
  });
}

export interface ResponseViewInput {
  name: string;
  description?: string;
  kind: string;
  templateId?: string | null;
  isDefault: boolean;
  configuration: { fields: ResponseFieldConfigDto[] };
}

export function useCreateResponseView() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ResponseViewInput) => api.post<{ view: ResponseViewDto }>("/response-views", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["response-views"] }),
  });
}

export function useUpdateResponseView() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ResponseViewInput }) =>
      api.put<{ view: ResponseViewDto }>(`/response-views/${id}`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["response-views"] }),
  });
}

export function useDeleteResponseView() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/response-views/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["response-views"] }),
  });
}

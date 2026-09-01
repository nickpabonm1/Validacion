import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api-client";

export interface SystemSettingDto {
  key: string;
  description: string | null;
  encrypted: boolean;
  configured: boolean;
  value?: string;
  updatedAt: string;
}

export function useSystemSettings() {
  return useQuery({
    queryKey: ["system-settings"],
    queryFn: () => api.get<{ settings: SystemSettingDto[] }>("/settings").then((r) => r.settings),
  });
}

export function useUpsertSetting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, value, description, encrypted }: { key: string; value: string; description?: string; encrypted: boolean }) =>
      api.put(`/settings/${key}`, { value, description, encrypted }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["system-settings"] }),
  });
}

export function useDeleteSetting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (key: string) => api.delete(`/settings/${key}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["system-settings"] }),
  });
}

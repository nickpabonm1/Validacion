import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { MessagingConfigDto } from "@fad-console/shared-types";
import type { MessagingConfigInput } from "@fad-console/validation-schemas";
import { api } from "../../lib/api-client";

export function useMessagingConfig() {
  return useQuery({
    queryKey: ["messaging-config"],
    queryFn: () => api.get<{ messagingConfig: MessagingConfigDto }>("/messaging-config").then((r) => r.messagingConfig),
  });
}

export function useUpdateMessagingConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: MessagingConfigInput) =>
      api.put<{ messagingConfig: MessagingConfigDto }>("/messaging-config", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["messaging-config"] }),
  });
}

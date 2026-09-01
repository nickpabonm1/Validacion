import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api-client";

export interface WebhookEventListItem {
  id: string;
  externalEventId: string;
  eventType: string;
  validationId: string | null;
  receivedAt: string;
  retry: number;
  processingStatus: string;
  processedAt: string | null;
  processingError: string | null;
}

export interface WebhookEventDetail extends WebhookEventListItem {
  payload: unknown;
}

export function useWebhookEvents(filters: { eventType?: string; processingStatus?: string }) {
  return useQuery({
    queryKey: ["webhooks", filters],
    queryFn: () =>
      api.get<{ events: WebhookEventListItem[] }>("/webhooks", filters as Record<string, string | undefined>).then((r) => r.events),
    refetchInterval: 10_000,
  });
}

export function useWebhookEvent(id: string | undefined) {
  return useQuery({
    queryKey: ["webhooks", "detail", id],
    queryFn: () => api.get<{ event: WebhookEventDetail }>(`/webhooks/${id}`).then((r) => r.event),
    enabled: Boolean(id),
  });
}

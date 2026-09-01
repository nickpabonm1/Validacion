import { useState } from "react";
import { useWebhookEvents, useWebhookEvent } from "../features/webhooks/useWebhooks";
import { PageHeader, Skeleton, EmptyState } from "../components/ui/misc";
import { Badge } from "../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../components/ui/dialog";

const STATUS_TONE: Record<string, "success" | "error" | "warning" | "neutral"> = {
  PROCESSED: "success",
  ERROR: "error",
  UNKNOWN_EVENT: "warning",
  RECEIVED: "neutral",
  DUPLICATE: "neutral",
};

export function WebhooksPage() {
  const { data: events, isLoading } = useWebhookEvents({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: selectedEvent } = useWebhookEvent(selectedId ?? undefined);

  return (
    <div>
      <PageHeader title="Webhooks" description="Eventos recibidos desde FAD, procesados de forma idempotente." />

      {isLoading ? (
        <Skeleton className="h-64" />
      ) : !events || events.length === 0 ? (
        <EmptyState title="Sin eventos de webhook todavía" description="Los eventos llegarán a /api/webhooks/fad." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Evento</th>
                <th className="px-4 py-2.5 font-medium">Validation ID</th>
                <th className="px-4 py-2.5 font-medium">Recibido</th>
                <th className="px-4 py-2.5 font-medium">Reintentos</th>
                <th className="px-4 py-2.5 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr
                  key={event.id}
                  className="cursor-pointer border-t border-border hover:bg-muted/40"
                  onClick={() => setSelectedId(event.id)}
                >
                  <td className="px-4 py-2.5 font-mono text-xs">{event.eventType}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{event.validationId ?? "—"}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{new Date(event.receivedAt).toLocaleString()}</td>
                  <td className="px-4 py-2.5">{event.retry}</td>
                  <td className="px-4 py-2.5">
                    <Badge tone={STATUS_TONE[event.processingStatus] ?? "neutral"}>{event.processingStatus}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={Boolean(selectedId)} onOpenChange={(open) => !open && setSelectedId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedEvent?.eventType}</DialogTitle>
          </DialogHeader>
          {selectedEvent ? (
            <div className="space-y-3">
              {selectedEvent.processingError ? (
                <p className="rounded-md bg-destructive/10 p-2 text-xs text-destructive">{selectedEvent.processingError}</p>
              ) : null}
              <pre className="max-h-96 overflow-auto rounded-md bg-muted p-3 text-xs">
                {JSON.stringify(selectedEvent.payload, null, 2)}
              </pre>
            </div>
          ) : (
            <Skeleton className="h-40" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

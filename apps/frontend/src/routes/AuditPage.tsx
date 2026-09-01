import { useState } from "react";
import { useAuditLogs } from "../features/audit/useAuditLogs";
import { PageHeader, Skeleton, EmptyState } from "../components/ui/misc";
import { Select } from "../components/ui/select";
import { Badge } from "../components/ui/badge";

const ACTIONS = [
  "LOGIN",
  "LOGIN_FAILED",
  "LOGOUT",
  "CREATE",
  "UPDATE",
  "DELETE",
  "REVEAL_SECRET",
  "TEST_CONNECTION",
  "EXECUTE_VALIDATION",
  "QUERY_VALIDATION",
  "WEBHOOK_RECEIVED",
];

export function AuditPage() {
  const [action, setAction] = useState("");
  const { data: logs, isLoading } = useAuditLogs({ action: action || undefined });

  return (
    <div>
      <PageHeader title="Auditoría" description="Trazabilidad de operaciones realizadas en la consola." />

      <div className="mb-4">
        <Select value={action} onChange={(e) => setAction(e.target.value)} className="w-56">
          <option value="">Todas las acciones</option>
          {ACTIONS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </Select>
      </div>

      {isLoading ? (
        <Skeleton className="h-64" />
      ) : !logs || logs.length === 0 ? (
        <EmptyState title="Sin registros de auditoría" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Fecha</th>
                <th className="px-4 py-2.5 font-medium">Usuario</th>
                <th className="px-4 py-2.5 font-medium">Acción</th>
                <th className="px-4 py-2.5 font-medium">Entidad</th>
                <th className="px-4 py-2.5 font-medium">IP</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-t border-border">
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-2.5">{log.userName ?? "Sistema"}</td>
                  <td className="px-4 py-2.5">
                    <Badge tone={log.action.includes("FAILED") ? "error" : "neutral"}>{log.action}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-xs">
                    {log.entityType ?? "—"} {log.entityId ? <span className="font-mono text-muted-foreground">{log.entityId.slice(0, 8)}</span> : null}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{log.ip ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

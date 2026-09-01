import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PlayCircle, Search } from "lucide-react";
import { useExecutionsList } from "../features/executions/useExecutions";
import { useEnvironments } from "../features/environments/useEnvironments";
import { PageHeader, Skeleton, EmptyState } from "../components/ui/misc";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { StatusBadge, ResultBadge } from "../components/domain/StatusBadge";

const STATUS_OPTIONS = ["CREATED", "IN_PROGRESS", "COMPLETED", "FAILED", "EXPIRED", "CANCELLED", "UNKNOWN"];

export function ExecutionsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [environmentId, setEnvironmentId] = useState("");
  const { data: environments = [] } = useEnvironments();
  const { data: executions, isLoading } = useExecutionsList({
    search: search || undefined,
    status: status || undefined,
    environmentId: environmentId || undefined,
  });

  return (
    <div>
      <PageHeader
        title="Validaciones"
        description="Historial de ejecuciones de validación por pasos."
        actions={
          <Button onClick={() => navigate("/executions/new")}>
            <PlayCircle className="h-4 w-4" /> Nueva ejecución
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por validationId, proceso o correo…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-48">
          <option value="">Todos los estados</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        <Select value={environmentId} onChange={(e) => setEnvironmentId(e.target.value)} className="w-56">
          <option value="">Todos los ambientes</option>
          {environments.map((env) => (
            <option key={env.id} value={env.id}>
              {env.name}
            </option>
          ))}
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : !executions || executions.length === 0 ? (
        <EmptyState
          title="Sin validaciones"
          description="Ejecuta tu primera validación desde el asistente."
          action={<Button onClick={() => navigate("/executions/new")}>Nueva ejecución</Button>}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Proceso</th>
                <th className="px-4 py-2.5 font-medium">Cliente</th>
                <th className="px-4 py-2.5 font-medium">Ambiente</th>
                <th className="px-4 py-2.5 font-medium">Estado</th>
                <th className="px-4 py-2.5 font-medium">Resultado</th>
                <th className="px-4 py-2.5 font-medium">Creada</th>
              </tr>
            </thead>
            <tbody>
              {executions.map((execution) => (
                <tr
                  key={execution.id}
                  className="cursor-pointer border-t border-border hover:bg-muted/40"
                  onClick={() => navigate(`/executions/${execution.id}`)}
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      {execution.processName}
                      {execution.isDemo ? <Badge tone="warning">DEMO</Badge> : null}
                    </div>
                    <p className="font-mono text-xs text-muted-foreground">{execution.validationId ?? "—"}</p>
                  </td>
                  <td className="px-4 py-2.5">
                    <p>{execution.clientNameMasked}</p>
                    <p className="text-xs text-muted-foreground">{execution.clientEmailMasked}</p>
                  </td>
                  <td className="px-4 py-2.5">{execution.environmentName}</td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={execution.normalizedStatus} />
                  </td>
                  <td className="px-4 py-2.5">
                    <ResultBadge result={execution.result} />
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">
                    {new Date(execution.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

import { Link } from "react-router-dom";
import { Activity, CheckCircle2, Clock, Gauge, Webhook, XCircle } from "lucide-react";
import { useDashboardStats } from "../features/settings/useDashboardStats";
import { PageHeader, Skeleton, EmptyState } from "../components/ui/misc";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { StatusBadge } from "../components/domain/StatusBadge";
import { Badge } from "../components/ui/badge";

function StatCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: typeof Activity }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
        </div>
        <div className="rounded-full bg-primary/10 p-2.5 text-primary">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return "—";
  if (seconds < 60) return `${seconds}s`;
  return `${Math.round(seconds / 60)} min`;
}

export function DashboardPage() {
  const { data: stats, isLoading } = useDashboardStats();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Inicio" description="Resumen general de la consola." />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const isEmpty = stats.totals.validations === 0 && stats.webhooks.received === 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Inicio" description="Resumen general de la consola." />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Validaciones creadas" value={stats.totals.validations} icon={Activity} />
        <StatCard label="En proceso" value={stats.totals.inProgress} icon={Clock} />
        <StatCard label="Completadas" value={stats.totals.completed} icon={CheckCircle2} />
        <StatCard label="Fallidas" value={stats.totals.failed} icon={XCircle} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="Webhooks recibidos" value={stats.webhooks.received} icon={Webhook} />
        <StatCard label="Webhooks con error" value={stats.webhooks.errors} icon={XCircle} />
        <StatCard label="Tasa de finalización" value={`${stats.completionRatePercent}%`} icon={Gauge} />
      </div>

      {isEmpty ? (
        <EmptyState
          title="Todavía no hay actividad"
          description="Crea un ambiente, una plantilla y ejecuta tu primera validación para ver estadísticas aquí."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Últimas validaciones</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {stats.recentExecutions.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin validaciones todavía.</p>
              ) : (
                stats.recentExecutions.map((execution) => (
                  <Link
                    key={execution.id}
                    to={`/executions/${execution.id}`}
                    className="flex items-center justify-between rounded-md px-2 py-2 text-sm hover:bg-muted"
                  >
                    <span className="truncate">{execution.processName}</span>
                    <StatusBadge status={execution.normalizedStatus} />
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Últimos eventos de webhook</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {stats.recentWebhookEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin eventos todavía.</p>
              ) : (
                stats.recentWebhookEvents.map((event) => (
                  <div key={event.id} className="flex items-center justify-between px-2 py-2 text-sm">
                    <span className="truncate font-mono text-xs">{event.eventType}</span>
                    <Badge tone={event.processingStatus === "ERROR" ? "error" : "neutral"}>
                      {event.processingStatus}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Estado de conexión por ambiente</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              {stats.environments.map((env) => (
                <Badge
                  key={env.id}
                  tone={env.connectionStatus === "OK" ? "success" : env.connectionStatus === "FAILED" ? "error" : "neutral"}
                >
                  {env.name}: {env.connectionStatus === "NOT_CONFIGURED" ? "Pendiente de configuración" : env.connectionStatus}
                </Badge>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 text-sm text-muted-foreground">
              Tiempo promedio de finalización: <span className="font-medium text-foreground">{formatDuration(stats.averageDurationSeconds)}</span>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, Circle, Clock, Copy, Eye, Loader2, RefreshCcw, XCircle } from "lucide-react";
import { useExecutionDetail, useRevealSecret, useSyncExecution } from "../features/executions/useExecutions";
import { useResponseViews, useApplyResponseView } from "../features/response-views/useResponseViews";
import { useEnvironments } from "../features/environments/useEnvironments";
import { PageHeader, Skeleton, EmptyState } from "../components/ui/misc";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Select } from "../components/ui/select";
import { Badge } from "../components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { StatusBadge, ResultBadge } from "../components/domain/StatusBadge";
import { RenderedFieldValue } from "../components/domain/RenderedFieldValue";
import { ReportView } from "../components/domain/ReportView";
import { OcrTable } from "../components/domain/OcrTable";
import { ShareLinkPanel } from "../components/domain/ShareLinkPanel";
import { sanitizeStepData, isPlainObject } from "../lib/sanitize-step-data";
import { buildLaunchUrl } from "../lib/launch-url";
import { useToast } from "../components/ui/toast";

const STEP_STATUS_ICON: Record<string, typeof CheckCircle2> = {
  COMPLETED: CheckCircle2,
  IN_PROGRESS: Clock,
  FAILED: XCircle,
  PENDING: Circle,
  SKIPPED: Circle,
  UNKNOWN: Circle,
};

export function ExecutionDetailPage() {
  const { executionId } = useParams();
  const { data: execution, isLoading } = useExecutionDetail(executionId);
  const { data: views = [] } = useResponseViews();
  const { data: environments = [] } = useEnvironments();
  const syncExecution = useSyncExecution();
  const revealSecret = useRevealSecret();
  const { notify } = useToast();

  const [selectedViewId, setSelectedViewId] = useState<string | undefined>(undefined);
  const [revealed, setRevealed] = useState<{ key?: string; vector?: string }>({});

  const activeView = useMemo(() => {
    if (selectedViewId) return selectedViewId;
    return views.find((v) => v.kind === "EXECUTIVE" && v.isDefault)?.id ?? views[0]?.id;
  }, [selectedViewId, views]);

  const { data: renderedFields, isLoading: loadingView } = useApplyResponseView(activeView, executionId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  if (!execution) {
    return <EmptyState title="Validación no encontrada" />;
  }

  const environment = environments.find((e) => e.id === execution.environment.id);
  const launchUrl = buildLaunchUrl(environment?.launchUrlTemplate, execution.validationId, revealed);

  const grouped = new Map<string, typeof renderedFields>();
  for (const field of renderedFields ?? []) {
    const list = grouped.get(field.group) ?? [];
    list.push(field);
    grouped.set(field.group, list);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={execution.processName}
        description={<span className="font-mono text-xs">{execution.validationId ?? "Sin validationId"}</span>}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void navigator.clipboard.writeText(execution.validationId ?? "");
                notify({ title: "Copiado", tone: "info" });
              }}
            >
              <Copy className="h-3.5 w-3.5" /> Copiar ID
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={syncExecution.isPending}
              onClick={() => syncExecution.mutate(execution.id)}
            >
              {syncExecution.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
              Consultar estado
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge status={execution.normalizedStatus} />
        <ResultBadge result={execution.result} />
        {execution.isDemo ? <Badge tone="warning">DEMO</Badge> : null}
        <span className="text-xs text-muted-foreground">Estado original (raw): {execution.rawStatus ?? "—"}</span>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Ambiente</p>
            <p className="font-medium">{execution.environment.name}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Plantilla</p>
            <p className="font-medium">{execution.template?.name ?? "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Cliente</p>
            <p className="font-medium">{execution.clientNameMasked}</p>
            <p className="text-xs text-muted-foreground">{execution.clientEmailMasked}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Última sincronización</p>
            <p className="font-medium">{execution.lastSyncedAt ? new Date(execution.lastSyncedAt).toLocaleString() : "—"}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SecretRow label="Key" masked={execution.keyMasked} value={revealed.key} onReveal={async () => {
          const res = await revealSecret.mutateAsync({ id: execution.id, field: "key" });
          setRevealed((prev) => ({ ...prev, key: res.value }));
        }} />
        <SecretRow label="Vector" masked={execution.vectorMasked} value={revealed.vector} onReveal={async () => {
          const res = await revealSecret.mutateAsync({ id: execution.id, field: "vector" });
          setRevealed((prev) => ({ ...prev, vector: res.value }));
        }} />
      </div>

      {launchUrl ? (
        <ShareLinkPanel url={launchUrl} processName={execution.processName} />
      ) : environment?.launchUrlTemplate ? (
        <p className="text-xs text-muted-foreground">
          Revela key/vector arriba para generar el enlace del proceso, el código QR y las opciones para compartirlo.
        </p>
      ) : null}

      <Tabs defaultValue="report">
        <TabsList>
          <TabsTrigger value="report">Reporte</TabsTrigger>
          <TabsTrigger value="summary">Vista personalizada</TabsTrigger>
          <TabsTrigger value="steps">Pasos</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks ({execution.webhookEvents.length})</TabsTrigger>
          <TabsTrigger value="raw">JSON original</TabsTrigger>
        </TabsList>

        <TabsContent value="report">
          {execution.normalized ? (
            <ReportView detail={execution.normalized} executionId={execution.id} />
          ) : (
            <EmptyState title="Todavía no hay datos de resultado" description="Usa «Consultar estado» para traer la información desde FAD." />
          )}
        </TabsContent>

        <TabsContent value="summary">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Vista</p>
            <Select value={activeView ?? ""} onChange={(e) => setSelectedViewId(e.target.value)} className="w-56">
              {views.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </Select>
          </div>
          {loadingView ? (
            <Skeleton className="h-40" />
          ) : !renderedFields || renderedFields.length === 0 ? (
            <EmptyState title="Sin campos configurados en esta vista" />
          ) : (
            <div className="space-y-4">
              {[...grouped.entries()].map(([group, fields]) => (
                <Card key={group}>
                  <CardHeader>
                    <CardTitle>{group}</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3 md:grid-cols-2">
                    {fields!.map((field) => (
                      <div key={field.id}>
                        <p className="text-xs text-muted-foreground">{field.label}</p>
                        <RenderedFieldValue field={field} />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="steps">
          <div className="space-y-2">
            {execution.steps
              .sort((a, b) => a.order - b.order)
              .map((step) => {
                const Icon = STEP_STATUS_ICON[step.status] ?? Circle;
                return (
                  <div key={step.id} className="flex items-start gap-3 rounded-lg border border-border p-3">
                    <Icon
                      className={`mt-0.5 h-5 w-5 shrink-0 ${
                        step.status === "COMPLETED"
                          ? "text-success"
                          : step.status === "FAILED"
                            ? "text-destructive"
                            : step.status === "IN_PROGRESS"
                              ? "text-warning"
                              : "text-muted-foreground"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">
                          {step.order}. {step.stepKey}
                        </p>
                        <StatusBadge status={step.status} />
                      </div>
                      {step.data && isPlainObject(sanitizeStepData(step.data)) ? (
                        <div className="mt-2">
                          <OcrTable data={sanitizeStepData(step.data) as Record<string, unknown>} />
                        </div>
                      ) : step.data ? (
                        <p className="mt-2 text-xs text-muted-foreground">{String(sanitizeStepData(step.data))}</p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
          </div>
        </TabsContent>

        <TabsContent value="webhooks">
          {execution.webhookEvents.length === 0 ? (
            <EmptyState title="Sin eventos de webhook para esta validación" />
          ) : (
            <div className="space-y-2">
              {execution.webhookEvents.map((event) => (
                <div key={event.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                  <span className="font-mono text-xs">{event.eventType}</span>
                  <span className="text-xs text-muted-foreground">{new Date(event.receivedAt).toLocaleString()}</span>
                  <Badge tone={event.processingStatus === "ERROR" ? "error" : "neutral"}>{event.processingStatus}</Badge>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="raw">
          <pre className="max-h-[32rem] overflow-auto rounded-md bg-muted p-3 text-xs">
            {JSON.stringify(execution.normalized, null, 2)}
          </pre>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SecretRow({
  label,
  masked,
  value,
  onReveal,
}: {
  label: string;
  masked: string | null;
  value: string | undefined;
  onReveal: () => Promise<void>;
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="truncate font-mono text-sm">{value ?? masked ?? "—"}</p>
        </div>
        {!value ? (
          <Button variant="ghost" size="sm" onClick={() => void onReveal()}>
            <Eye className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

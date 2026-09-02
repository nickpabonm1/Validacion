import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Copy,
  Eye,
  FlaskConical,
  Loader2,
  XCircle,
} from "lucide-react";
import { getStepCatalogEntry } from "@fad-console/shared-types";
import { pruneEmptyRequestFields } from "@fad-console/validation-schemas";
import type { ValidationRequestConfig } from "@fad-console/validation-schemas";
import { useEnvironments } from "../features/environments/useEnvironments";
import { useTemplates } from "../features/templates/useTemplates";
import {
  useCreateExecution,
  useCreateDemoExecution,
  useRevealSecret,
  type ExecutionDetailDto,
} from "../features/executions/useExecutions";
import { PageHeader, EmptyState, Spinner } from "../components/ui/misc";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Field } from "../builder/editors/Field";
import { Badge } from "../components/ui/badge";
import { StatusBadge, ResultBadge } from "../components/domain/StatusBadge";
import { ShareLinkPanel } from "../components/domain/ShareLinkPanel";
import { buildLaunchUrl } from "../lib/launch-url";
import { useToast } from "../components/ui/toast";

const STEP_LABELS = [
  "Ambiente",
  "Plantilla",
  "Cliente",
  "Revisión",
  "JSON final",
  "Confirmar",
  "Resultado",
] as const;

export function NewExecutionPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { notify } = useToast();

  const { data: environments = [], isLoading: loadingEnvironments } = useEnvironments();
  const { data: templates = [], isLoading: loadingTemplates } = useTemplates();
  const createExecution = useCreateExecution();
  const createDemoExecution = useCreateDemoExecution();
  const revealSecret = useRevealSecret();

  const [step, setStep] = useState(0);
  const [environmentId, setEnvironmentId] = useState("");
  const [templateId, setTemplateId] = useState<string | undefined>(searchParams.get("templateId") ?? undefined);
  const [config, setConfig] = useState<ValidationRequestConfig | null>(null);
  const [result, setResult] = useState<ExecutionDetailDto | null>(null);
  const [revealed, setRevealed] = useState<{ key?: string; vector?: string }>({});

  const selectedEnvironment = environments.find((e) => e.id === environmentId);
  const selectedTemplate = templates.find((t) => t.id === templateId);

  useEffect(() => {
    if (templateId && !config) {
      const tpl = templates.find((t) => t.id === templateId);
      if (tpl) setConfig(structuredClone(tpl.requestConfig));
    }
  }, [templateId, templates, config]);

  const canExecuteReal = Boolean(selectedEnvironment?.apiUsernameConfigured && selectedEnvironment?.apiPasswordConfigured);

  function selectTemplate(id: string) {
    setTemplateId(id);
    const tpl = templates.find((t) => t.id === id);
    if (tpl) setConfig(structuredClone(tpl.requestConfig));
  }

  async function handleExecute(demo: boolean) {
    if (!config || !environmentId) return;
    try {
      const mutation = demo ? createDemoExecution : createExecution;
      const res = await mutation.mutateAsync({ environmentId, templateId, requestConfig: config });
      setResult(res.execution);
      setStep(6);
      notify({ title: demo ? "Ejecución simulada (DEMO)" : "Validación creada", tone: "success" });
    } catch (error) {
      notify({ title: "No se pudo ejecutar", description: (error as Error).message, tone: "error" });
    }
  }

  const stepValid = [
    Boolean(environmentId),
    Boolean(templateId && config),
    Boolean(config?.client.name && config?.client.mail && config?.client.phone),
    true,
    true,
    true,
    true,
  ];

  return (
    <div>
      <PageHeader title="Nueva ejecución" description="Asistente para crear una nueva validación." />

      <ol className="mb-6 flex flex-wrap gap-2" aria-label="Progreso del asistente">
        {STEP_LABELS.map((label, index) => (
          <li key={label}>
            <button
              type="button"
              disabled={index > step && !(index <= step + 1 && stepValid[step])}
              onClick={() => index <= step && setStep(index)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                index === step
                  ? "bg-primary text-primary-foreground"
                  : index < step
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {index + 1}. {label}
            </button>
          </li>
        ))}
      </ol>

      <Card>
        <CardContent className="p-6">
          {step === 0 ? (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold">Selecciona un ambiente</h2>
              {loadingEnvironments ? (
                <Spinner />
              ) : environments.length === 0 ? (
                <EmptyState title="No hay ambientes configurados" description="Crea uno en Ambientes." />
              ) : (
                <div className="grid gap-2 md:grid-cols-2">
                  {environments.map((env) => (
                    <button
                      key={env.id}
                      onClick={() =>
                        env.integrationModel === "WEB_SDK"
                          ? navigate(`/executions/new-websdk?environmentId=${env.id}`)
                          : setEnvironmentId(env.id)
                      }
                      className={`rounded-lg border p-4 text-left transition-colors ${
                        environmentId === env.id ? "border-primary ring-1 ring-primary" : "border-border hover:bg-muted"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium">{env.name}</p>
                        <div className="flex shrink-0 gap-1.5">
                          {env.integrationModel === "WEB_SDK" ? <Badge tone="info">Web SDK</Badge> : null}
                          <Badge tone={env.connectionStatus === "OK" ? "success" : env.connectionStatus === "FAILED" ? "error" : "neutral"}>
                            {env.connectionStatus === "NOT_CONFIGURED" ? "Pendiente de configuración" : env.connectionStatus}
                          </Badge>
                        </div>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{env.environmentType} · {env.baseUrl}</p>
                      {env.integrationModel === "WEB_SDK" ? (
                        <p className="mt-1 text-xs text-primary">La captura corre en el navegador (Acuant + Facetec) →</p>
                      ) : null}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {step === 1 ? (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold">Selecciona una plantilla</h2>
              {loadingTemplates ? (
                <Spinner />
              ) : templates.length === 0 ? (
                <EmptyState title="No hay plantillas" description="Crea una en el Constructor." />
              ) : (
                <div className="grid gap-2 md:grid-cols-2">
                  {templates
                    .filter((t) => t.active)
                    .map((tpl) => (
                      <button
                        key={tpl.id}
                        onClick={() => selectTemplate(tpl.id)}
                        className={`rounded-lg border p-4 text-left transition-colors ${
                          templateId === tpl.id ? "border-primary ring-1 ring-primary" : "border-border hover:bg-muted"
                        }`}
                      >
                        <p className="font-medium">{tpl.name}</p>
                        {tpl.description ? <p className="mt-1 text-xs text-muted-foreground">{tpl.description}</p> : null}
                        <p className="mt-1 text-xs text-muted-foreground">
                          {Object.keys(tpl.requestConfig.steps ?? {}).length} pasos
                        </p>
                      </button>
                    ))}
                </div>
              )}
            </div>
          ) : null}

          {step === 2 && config ? (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold">Datos del cliente</h2>
              <Field label="Nombre del proceso">
                <Input value={config.processName} onChange={(e) => setConfig({ ...config, processName: e.target.value })} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nombre del cliente">
                  <Input value={config.client.name} onChange={(e) => setConfig({ ...config, client: { ...config.client, name: e.target.value } })} />
                </Field>
                <Field label="Correo">
                  <Input
                    type="email"
                    value={config.client.mail}
                    onChange={(e) => setConfig({ ...config, client: { ...config.client, mail: e.target.value } })}
                  />
                </Field>
              </div>
              <Field label="Teléfono" hint="Formato internacional, ej. +573001234567">
                <Input value={config.client.phone} onChange={(e) => setConfig({ ...config, client: { ...config.client, phone: e.target.value } })} />
              </Field>
            </div>
          ) : null}

          {step === 3 && config ? (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold">Revisar pasos y personalización</h2>
              <div className="space-y-2">
                {Object.entries(config.steps)
                  .sort((a, b) => a[1].order - b[1].order)
                  .map(([key, entry]) => {
                    const catalogEntry = getStepCatalogEntry(key);
                    return (
                      <div key={key} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                        <span>
                          {entry.order}. {catalogEntry?.label ?? key}
                        </span>
                        <Badge tone={entry.show ? "success" : "neutral"}>{entry.show ? "Visible" : "Oculto"}</Badge>
                      </div>
                    );
                  })}
              </div>
              {config.customization.theme.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {config.customization.theme.map((t) => (
                    <span key={t.key} className="flex items-center gap-1.5 rounded-full border border-border px-2 py-1 text-xs">
                      <span className="h-3 w-3 rounded-full border" style={{ backgroundColor: t.value }} />
                      {t.key.replace("--fad-common-", "")}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Sin personalización de tema configurada.</p>
              )}
            </div>
          ) : null}

          {step === 4 && config ? (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold">JSON final</h2>
              <pre className="max-h-96 overflow-auto rounded-md bg-muted p-3 text-xs">
                {JSON.stringify(pruneEmptyRequestFields(config), null, 2)}
              </pre>
            </div>
          ) : null}

          {step === 5 ? (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold">Confirmar y ejecutar</h2>
              <div className="rounded-md border border-border p-3 text-sm">
                <p>
                  Ambiente: <span className="font-medium">{selectedEnvironment?.name}</span>
                </p>
                <p>
                  Plantilla: <span className="font-medium">{selectedTemplate?.name}</span>
                </p>
              </div>
              {!canExecuteReal ? (
                <p className="rounded-md bg-warning/10 p-3 text-sm text-warning">
                  Debes configurar una conexión API antes de ejecutar la validación. Puedes simular el resultado en
                  modo demostración mientras tanto.
                </p>
              ) : null}
              <div className="flex gap-2">
                <Button disabled={!canExecuteReal || createExecution.isPending} onClick={() => handleExecute(false)}>
                  {createExecution.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Ejecutar validación
                </Button>
                <Button variant="outline" disabled={createDemoExecution.isPending} onClick={() => handleExecute(true)}>
                  <FlaskConical className="h-4 w-4" />
                  {createDemoExecution.isPending ? "Simulando…" : "Simular en modo DEMO"}
                </Button>
              </div>
            </div>
          ) : null}

          {step === 6 && result ? (
            <ResultStep
              result={result}
              environmentLaunchTemplate={selectedEnvironment?.launchUrlTemplate ?? null}
              revealed={revealed}
              onReveal={async (field) => {
                const res = await revealSecret.mutateAsync({ id: result.id, field });
                setRevealed((prev) => ({ ...prev, [field]: res.value }));
              }}
              onGoToDetail={() => navigate(`/executions/${result.id}`)}
            />
          ) : null}
        </CardContent>
      </Card>

      {step < 6 ? (
        <div className="mt-4 flex justify-between">
          <Button variant="outline" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
            <ArrowLeft className="h-4 w-4" /> Anterior
          </Button>
          <Button disabled={!stepValid[step]} onClick={() => setStep((s) => Math.min(5, s + 1))}>
            Siguiente <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function ResultStep({
  result,
  environmentLaunchTemplate,
  revealed,
  onReveal,
  onGoToDetail,
}: {
  result: ExecutionDetailDto;
  environmentLaunchTemplate: string | null;
  revealed: { key?: string; vector?: string };
  onReveal: (field: "key" | "vector") => Promise<void>;
  onGoToDetail: () => void;
}) {
  const { notify } = useToast();
  const launchUrl = buildLaunchUrl(environmentLaunchTemplate, result.validationId, revealed);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {result.normalizedStatus === "FAILED" ? (
          <XCircle className="h-6 w-6 text-destructive" />
        ) : (
          <CheckCircle2 className="h-6 w-6 text-success" />
        )}
        <h2 className="text-base font-semibold">
          {result.isDemo ? "Ejecución simulada (DEMO)" : "Validación creada"}
        </h2>
        {result.isDemo ? <Badge tone="warning">DEMO</Badge> : null}
      </div>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Validation ID</dt>
          <dd className="flex items-center gap-1.5 font-mono text-xs">
            {result.validationId}
            <button
              type="button"
              aria-label="Copiar validationId"
              onClick={() => {
                void navigator.clipboard.writeText(result.validationId ?? "");
                notify({ title: "Copiado al portapapeles", tone: "info" });
              }}
            >
              <Copy className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
            </button>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Estado</dt>
          <dd>
            <StatusBadge status={result.normalizedStatus} /> <ResultBadge result={result.result} />
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Ambiente</dt>
          <dd>{result.environment.name}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Plantilla</dt>
          <dd>{result.template?.name ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Fecha y hora</dt>
          <dd>{result.createdAt ? new Date(result.createdAt).toLocaleString() : "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Cliente</dt>
          <dd>
            {result.clientNameMasked} · {result.clientEmailMasked}
          </dd>
        </div>
      </dl>

      <div className="grid grid-cols-2 gap-3">
        <SecretRow label="Key" masked={result.keyMasked} value={revealed.key} onReveal={() => onReveal("key")} />
        <SecretRow label="Vector" masked={result.vectorMasked} value={revealed.vector} onReveal={() => onReveal("vector")} />
      </div>

      <div className="flex flex-wrap gap-2 pt-2">
        <Button onClick={onGoToDetail}>Ver detalle de la validación</Button>
      </div>

      {launchUrl ? (
        <ShareLinkPanel url={launchUrl} processName={result.processName} />
      ) : environmentLaunchTemplate ? (
        <p className="text-xs text-muted-foreground">
          Revela key/vector para generar el enlace del proceso, el código QR y las opciones para compartirlo.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Configura la plantilla de enlace (&quot;launchUrlTemplate&quot;) del ambiente en Ambientes para generar aquí el
          enlace, el código QR y las opciones para compartirlo con el cliente.
        </p>
      )}
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
  onReveal: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-mono">{value ?? masked ?? "—"}</p>
      </div>
      {!value ? (
        <Button variant="ghost" size="sm" onClick={onReveal}>
          <Eye className="h-3.5 w-3.5" /> Revelar
        </Button>
      ) : null}
    </div>
  );
}

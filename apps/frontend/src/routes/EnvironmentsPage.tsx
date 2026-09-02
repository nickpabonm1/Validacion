import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Plus, Upload, X, XCircle } from "lucide-react";
import { ApiEnvironmentInputSchema, type ApiEnvironmentInput } from "@fad-console/validation-schemas";
import type { ApiEnvironmentDto } from "@fad-console/shared-types";
import {
  useEnvironments,
  useCreateEnvironment,
  useUpdateEnvironment,
  useDeleteEnvironment,
  useClearCredential,
  useTestConnection,
} from "../features/environments/useEnvironments";
import { PageHeader, EmptyState, Skeleton } from "../components/ui/misc";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Field, InlineSwitchField } from "../builder/editors/Field";
import { CredentialInput } from "../components/domain/CredentialInput";
import { Badge } from "../components/ui/badge";
import { Card, CardContent } from "../components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { useToast } from "../components/ui/toast";
import { parsePostmanCollection, type PostmanImportResult } from "../lib/postman-import";

const BLANK: ApiEnvironmentInput = {
  name: "",
  environmentType: "UATHA",
  baseUrl: "",
  active: true,
  timeoutMs: 15000,
  maxRetries: 2,
  grantType: "password",
  passwordIsPreHashed: false,
  tokenRefreshMarginSeconds: 60,
  authTokenEndpoint: "/authorization-server/oauth/token",
  createValidationEndpoint: "/biometrics-by-steps/validations",
  saveValidationStepEndpoint: "/validation/saveValidationStep/{validationId}",
  getValidationStepEndpoint: "/validation/getValidationStep/{validationId}",
  getValidationStepHttpMethod: "GET",
  getValidationDataEndpoint: "/validation/validations/getValidationData/{validationId}",
  webhookActive: false,
};

function toFormValues(env: ApiEnvironmentDto): ApiEnvironmentInput {
  return {
    name: env.name,
    description: env.description ?? undefined,
    environmentType: env.environmentType,
    baseUrl: env.baseUrl,
    active: env.active,
    timeoutMs: env.timeoutMs,
    maxRetries: env.maxRetries,
    grantType: env.grantType,
    passwordIsPreHashed: env.passwordIsPreHashed,
    tokenRefreshMarginSeconds: env.tokenRefreshMarginSeconds,
    authTokenEndpoint: env.authTokenEndpoint,
    createValidationEndpoint: env.createValidationEndpoint,
    saveValidationStepEndpoint: env.saveValidationStepEndpoint,
    getValidationStepEndpoint: env.getValidationStepEndpoint,
    getValidationStepHttpMethod: env.getValidationStepHttpMethod,
    getValidationDataEndpoint: env.getValidationDataEndpoint,
    launchUrlTemplate: env.launchUrlTemplate ?? undefined,
    webhookUrl: env.webhookUrl ?? undefined,
    webhookActive: env.webhookActive,
  };
}

export function EnvironmentsPage() {
  const { data: environments = [], isLoading } = useEnvironments();
  const createEnv = useCreateEnvironment();
  const updateEnv = useUpdateEnvironment();
  const deleteEnv = useDeleteEnvironment();
  const clearCredential = useClearCredential();
  const testConnection = useTestConnection();
  const { notify } = useToast();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [importResult, setImportResult] = useState<PostmanImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selected = environments.find((e) => e.id === selectedId) ?? null;

  const { register, handleSubmit, reset, setValue, watch, formState } = useForm<ApiEnvironmentInput>({
    resolver: zodResolver(ApiEnvironmentInputSchema),
    defaultValues: BLANK,
  });

  useEffect(() => {
    reset(selected ? toFormValues(selected) : BLANK);
    setTestResult(null);
    setImportResult(null);
  }, [selected, reset]);

  async function handleImportPostmanFile(file: File) {
    try {
      const text = await file.text();
      const result = parsePostmanCollection(JSON.parse(text));
      for (const [field, value] of Object.entries(result.values) as [keyof ApiEnvironmentInput, never][]) {
        setValue(field, value, { shouldDirty: true, shouldValidate: true });
      }
      setImportResult(result);
      notify({
        title: "Colección de Postman importada",
        description: `${result.matched.length} campo(s) completados desde "${result.collectionName}". Revisa antes de guardar.`,
        tone: result.warnings.length > 0 ? "warning" : "success",
      });
    } catch (error) {
      notify({
        title: "No se pudo importar la colección",
        description: error instanceof Error ? error.message : "Archivo inválido",
        tone: "error",
      });
    }
  }

  async function onSubmit(values: ApiEnvironmentInput) {
    try {
      if (selected) {
        await updateEnv.mutateAsync({ id: selected.id, input: values });
        notify({ title: "Ambiente actualizado", tone: "success" });
      } else {
        const res = await createEnv.mutateAsync(values);
        notify({ title: "Ambiente creado", tone: "success" });
        setSelectedId(res.environment.id);
      }
    } catch (error) {
      notify({ title: "Error al guardar", description: (error as Error).message, tone: "error" });
    }
  }

  const values = watch();

  return (
    <div>
      <PageHeader
        title="Configuración > Conexiones API"
        description="Ambientes y credenciales de conexión con FAD."
        actions={
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleImportPostmanFile(file);
                e.target.value = "";
              }}
            />
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4" /> Importar colección Postman
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-[280px_1fr] gap-6">
        <div className="space-y-2">
          <Button variant="outline" className="w-full" onClick={() => setSelectedId(null)}>
            <Plus className="h-4 w-4" /> Nueva conexión
          </Button>
          {isLoading ? (
            <Skeleton className="h-24" />
          ) : (
            environments.map((env) => (
              <button
                key={env.id}
                onClick={() => setSelectedId(env.id)}
                className={`block w-full rounded-lg border p-3 text-left ${
                  selectedId === env.id ? "border-primary ring-1 ring-primary" : "border-border hover:bg-muted"
                }`}
              >
                <p className="text-sm font-medium">{env.name}</p>
                <Badge
                  tone={env.connectionStatus === "OK" ? "success" : env.connectionStatus === "FAILED" ? "error" : "neutral"}
                  className="mt-1"
                >
                  {env.connectionStatus === "NOT_CONFIGURED" ? "Pendiente de configuración" : env.connectionStatus}
                </Badge>
              </button>
            ))
          )}
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          {importResult ? (
            <div
              className={`mb-4 rounded-lg border p-4 text-sm ${
                importResult.warnings.length > 0 ? "border-warning/30 bg-warning/5" : "border-success/30 bg-success/5"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium">
                  Importado desde &quot;{importResult.collectionName}&quot;: {importResult.matched.length} campo(s)
                  completado(s). Revisa los datos en las pestañas y guarda para confirmar.
                </p>
                <button
                  type="button"
                  aria-label="Cerrar aviso de importación"
                  onClick={() => setImportResult(null)}
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {importResult.matched.length > 0 ? (
                <ul className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                  {importResult.matched.map((m) => (
                    <li key={m.field}>
                      <span className="font-medium text-foreground">{m.label}:</span>{" "}
                      <span className="font-mono">{m.field.toLowerCase().includes("password") ? "••••••••" : m.value}</span>{" "}
                      <span>(de &quot;{m.sourceRequestName}&quot;)</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {importResult.warnings.length > 0 ? (
                <ul className="mt-2 list-inside list-disc space-y-0.5 text-xs text-warning">
                  {importResult.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          <Tabs defaultValue="general">
            <TabsList>
              <TabsTrigger value="general">Datos generales</TabsTrigger>
              <TabsTrigger value="auth">Autenticación OAuth</TabsTrigger>
              <TabsTrigger value="endpoints">Endpoints</TabsTrigger>
              <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
            </TabsList>

            <TabsContent value="general">
              <Card>
                <CardContent className="grid gap-4 p-5 md:grid-cols-2">
                  <Field label="Nombre" htmlFor="name">
                    <Input id="name" {...register("name")} />
                  </Field>
                  <Field label="Tipo de ambiente" htmlFor="environmentType">
                    <Select id="environmentType" {...register("environmentType")}>
                      <option value="UATHA">UATHA</option>
                      <option value="QA">QA</option>
                      <option value="PRODUCTION">PRODUCTION</option>
                    </Select>
                  </Field>
                  <Field label="URL base" htmlFor="baseUrl" hint="Ej. https://uatha.firmaautografa.com">
                    <Input id="baseUrl" {...register("baseUrl")} />
                  </Field>
                  <Field label="Descripción" htmlFor="description">
                    <Input id="description" {...register("description")} />
                  </Field>
                  <Field label="Timeout (ms)" htmlFor="timeoutMs">
                    <Input id="timeoutMs" type="number" {...register("timeoutMs", { valueAsNumber: true })} />
                  </Field>
                  <Field label="Reintentos máximos" htmlFor="maxRetries">
                    <Input id="maxRetries" type="number" {...register("maxRetries", { valueAsNumber: true })} />
                  </Field>
                  <InlineSwitchField
                    label="Ambiente activo"
                    checked={values.active}
                    onChange={(v) => setValue("active", v)}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="auth">
              <Card>
                <CardContent className="grid gap-4 p-5 md:grid-cols-2">
                  <CredentialInput
                    id="basicAuthUsername"
                    label="Usuario Basic Auth"
                    configured={selected?.basicAuthUsernameConfigured ?? false}
                    value={values.basicAuthUsername ?? ""}
                    onChange={(v) => setValue("basicAuthUsername", v)}
                    onClear={selected ? () => clearCredential.mutate({ id: selected.id, field: "basicAuthUsername" }) : undefined}
                  />
                  <CredentialInput
                    id="basicAuthPassword"
                    label="Contraseña Basic Auth"
                    configured={selected?.basicAuthPasswordConfigured ?? false}
                    value={values.basicAuthPassword ?? ""}
                    onChange={(v) => setValue("basicAuthPassword", v)}
                    onClear={selected ? () => clearCredential.mutate({ id: selected.id, field: "basicAuthPassword" }) : undefined}
                  />
                  <CredentialInput
                    id="apiUsername"
                    label="Usuario de la API"
                    configured={selected?.apiUsernameConfigured ?? false}
                    value={values.apiUsername ?? ""}
                    onChange={(v) => setValue("apiUsername", v)}
                    onClear={selected ? () => clearCredential.mutate({ id: selected.id, field: "apiUsername" }) : undefined}
                  />
                  <CredentialInput
                    id="apiPassword"
                    label="Contraseña de la API"
                    configured={selected?.apiPasswordConfigured ?? false}
                    value={values.apiPassword ?? ""}
                    onChange={(v) => setValue("apiPassword", v)}
                    onClear={selected ? () => clearCredential.mutate({ id: selected.id, field: "apiPassword" }) : undefined}
                    hint="Se hashea con SHA-256 antes de enviarse, salvo que indique que ya está cifrada."
                  />
                  <Field label="Grant type" htmlFor="grantType">
                    <Input id="grantType" {...register("grantType")} />
                  </Field>
                  <Field label="Margen de renovación de token (s)" htmlFor="tokenRefreshMarginSeconds">
                    <Input id="tokenRefreshMarginSeconds" type="number" {...register("tokenRefreshMarginSeconds", { valueAsNumber: true })} />
                  </Field>
                  <InlineSwitchField
                    label="La contraseña ya está cifrada con SHA-256"
                    checked={values.passwordIsPreHashed}
                    onChange={(v) => setValue("passwordIsPreHashed", v)}
                  />
                  <div className="flex items-end">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!selected || testConnection.isPending}
                      onClick={async () => {
                        if (!selected) return;
                        const res = await testConnection.mutateAsync(selected.id);
                        setTestResult(res);
                      }}
                    >
                      Probar conexión
                    </Button>
                  </div>
                  {testResult ? (
                    <div
                      className={`col-span-2 flex items-center gap-2 rounded-md p-3 text-sm ${
                        testResult.success ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                      }`}
                    >
                      {testResult.success ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                      {testResult.message}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="endpoints">
              <Card>
                <CardContent className="grid gap-4 p-5">
                  <Field label="Endpoint de autenticación" htmlFor="authTokenEndpoint">
                    <Input id="authTokenEndpoint" {...register("authTokenEndpoint")} />
                  </Field>
                  <Field label="Endpoint crear validación" htmlFor="createValidationEndpoint">
                    <Input id="createValidationEndpoint" {...register("createValidationEndpoint")} />
                  </Field>
                  <Field label="Endpoint guardar paso" htmlFor="saveValidationStepEndpoint">
                    <Input id="saveValidationStepEndpoint" {...register("saveValidationStepEndpoint")} />
                  </Field>
                  <div className="grid grid-cols-[1fr_140px] gap-3">
                    <Field label="Endpoint consultar pasos" htmlFor="getValidationStepEndpoint">
                      <Input id="getValidationStepEndpoint" {...register("getValidationStepEndpoint")} />
                    </Field>
                    <Field label="Método HTTP" htmlFor="getValidationStepHttpMethod">
                      <Select id="getValidationStepHttpMethod" {...register("getValidationStepHttpMethod")}>
                        <option value="GET">GET</option>
                        <option value="POST">POST</option>
                      </Select>
                    </Field>
                  </div>
                  <Field label="Endpoint consultar información detallada" htmlFor="getValidationDataEndpoint">
                    <Input id="getValidationDataEndpoint" {...register("getValidationDataEndpoint")} />
                  </Field>
                  <Field
                    label="Plantilla de URL de lanzamiento (opcional)"
                    htmlFor="launchUrlTemplate"
                    hint="Admite {validationId}, {key}, {vector}. Vacío por defecto — nunca se infiere."
                  >
                    <Input id="launchUrlTemplate" {...register("launchUrlTemplate")} />
                  </Field>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="webhooks">
              <Card>
                <CardContent className="grid gap-4 p-5 md:grid-cols-2">
                  <CredentialInput
                    id="webhookUsername"
                    label="Usuario del webhook"
                    configured={selected?.webhookUsernameConfigured ?? false}
                    value={values.webhookUsername ?? ""}
                    onChange={(v) => setValue("webhookUsername", v)}
                    onClear={selected ? () => clearCredential.mutate({ id: selected.id, field: "webhookUsername" }) : undefined}
                  />
                  <CredentialInput
                    id="webhookPassword"
                    label="Contraseña del webhook"
                    configured={selected?.webhookPasswordConfigured ?? false}
                    value={values.webhookPassword ?? ""}
                    onChange={(v) => setValue("webhookPassword", v)}
                    onClear={selected ? () => clearCredential.mutate({ id: selected.id, field: "webhookPassword" }) : undefined}
                  />
                  <Field label="URL pública del webhook" htmlFor="webhookUrl" hint="Informativa: la URL real que FAD debe invocar es /api/webhooks/fad en su servidor.">
                    <Input id="webhookUrl" {...register("webhookUrl")} />
                  </Field>
                  <InlineSwitchField
                    label="Webhook activo"
                    checked={values.webhookActive}
                    onChange={(v) => setValue("webhookActive", v)}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="mt-4 flex justify-between">
            {selected ? (
              <Button
                type="button"
                variant="ghost"
                onClick={async () => {
                  if (!window.confirm(`¿Eliminar el ambiente "${selected.name}"?`)) return;
                  await deleteEnv.mutateAsync(selected.id);
                  notify({ title: "Ambiente eliminado", tone: "success" });
                  setSelectedId(null);
                }}
              >
                Eliminar ambiente
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" disabled={formState.isSubmitting}>
              {selected ? "Guardar cambios" : "Crear ambiente"}
            </Button>
          </div>
        </form>
      </div>

      {!isLoading && environments.length === 0 ? (
        <EmptyState title="No hay ambientes configurados" description="Crea el primero con el formulario de arriba." />
      ) : null}
    </div>
  );
}

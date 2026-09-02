import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, Fingerprint, IdCard, Loader2, RefreshCcw, XCircle } from "lucide-react";
import type { WebSdkSessionInitDto } from "@fad-console/shared-types";
import type { WebSdkAcuantResultInput, WebSdkFacetecResultInput } from "@fad-console/validation-schemas";
import { useEnvironments } from "../features/environments/useEnvironments";
import { useStartWebSdk, useSubmitAcuantResult, useSubmitFacetecResult, useCompleteWebSdk } from "../features/websdk/useWebSdk";
import { runAcuantCapture, runFacetecCapture, describeSdkError } from "../lib/fad-sdk-client";
import { PageHeader, EmptyState, Spinner } from "../components/ui/misc";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Field } from "../builder/editors/Field";
import { Badge } from "../components/ui/badge";
import { useToast } from "../components/ui/toast";

type Phase = "setup" | "document" | "liveness" | "completing" | "done" | "blocked";

export function WebSdkCapturePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { notify } = useToast();
  const { data: environments = [], isLoading: loadingEnvironments } = useEnvironments();
  const webSdkEnvironments = environments.filter((e) => e.integrationModel === "WEB_SDK");

  const startSdk = useStartWebSdk();
  const submitAcuant = useSubmitAcuantResult();
  const submitFacetec = useSubmitFacetecResult();
  const completeSdk = useCompleteWebSdk();

  const [phase, setPhase] = useState<Phase>("setup");
  const [environmentId, setEnvironmentId] = useState(searchParams.get("environmentId") ?? "");
  const [client, setClient] = useState({ name: "", mail: "", phone: "" });
  const [sdkInit, setSdkInit] = useState<WebSdkSessionInitDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkStatus, setCheckStatus] = useState<{ attemptsUsed: number; attemptsMax: number; risk: string } | null>(null);
  const [acuantResult, setAcuantResult] = useState<WebSdkAcuantResultInput | null>(null);
  const [facetecResult, setFacetecResult] = useState<WebSdkFacetecResultInput | null>(null);

  const canStart = Boolean(environmentId && client.name && client.mail && client.phone);

  async function handleStart() {
    setError(null);
    setBusy(true);
    try {
      const res = await startSdk.mutateAsync({ environmentId, client });
      setSdkInit(res.sdkInit);
      setPhase("document");
    } catch (e) {
      notify({ title: "No se pudo iniciar la sesión Web SDK", description: (e as Error).message, tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function handleCaptureDocument() {
    if (!sdkInit) return;
    setError(null);
    setBusy(true);
    try {
      const result = await runAcuantCapture(sdkInit);
      setAcuantResult(result);
      const check = await submitAcuant.mutateAsync({ executionId: sdkInit.executionId, input: result });
      setCheckStatus({ attemptsUsed: check.attemptsUsed, attemptsMax: check.attemptsMax, risk: check.risk });
      if (check.accepted) {
        setPhase("liveness");
      } else if (check.exhausted) {
        setPhase("blocked");
        setError(`NAAT-CHECK rechazó el documento (riesgo ${check.risk}) y se agotaron los ${check.attemptsMax} intentos permitidos.`);
      } else {
        setError(`NAAT-CHECK rechazó el documento (riesgo ${check.risk}). Vuelve a capturar (intento ${check.attemptsUsed}/${check.attemptsMax}).`);
      }
    } catch (e) {
      setError(describeSdkError(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleCaptureLiveness() {
    if (!sdkInit) return;
    setError(null);
    setBusy(true);
    try {
      const result = await runFacetecCapture(sdkInit);
      setFacetecResult(result);
      await submitFacetec.mutateAsync({ executionId: sdkInit.executionId, input: result });
      setPhase("completing");
    } catch (e) {
      setError(describeSdkError(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleComplete() {
    if (!sdkInit) return;
    setError(null);
    setBusy(true);
    try {
      await completeSdk.mutateAsync(sdkInit.executionId);
      setPhase("done");
      notify({ title: "Validación completada", tone: "success" });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Nueva ejecución — Web SDK"
        description="Captura de documento (Acuant) y prueba de vida (Facetec) directamente en el navegador."
      />

      <Card>
        <CardContent className="space-y-6 p-6">
          {phase === "setup" ? (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold">Selecciona un ambiente Web SDK</h2>
              {loadingEnvironments ? (
                <Spinner />
              ) : webSdkEnvironments.length === 0 ? (
                <EmptyState
                  title="No hay ambientes con modelo Web SDK"
                  description="Configura uno en Ambientes: cambia el «Modelo de integración» a Web SDK y completa la pestaña «Web SDK»."
                />
              ) : (
                <div className="grid gap-2 md:grid-cols-2">
                  {webSdkEnvironments.map((env) => (
                    <button
                      key={env.id}
                      onClick={() => setEnvironmentId(env.id)}
                      className={`rounded-lg border p-4 text-left transition-colors ${
                        environmentId === env.id ? "border-primary ring-1 ring-primary" : "border-border hover:bg-muted"
                      }`}
                    >
                      <p className="font-medium">{env.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{env.environmentType} · {env.baseUrl}</p>
                    </button>
                  ))}
                </div>
              )}

              <h2 className="text-sm font-semibold">Datos del cliente</h2>
              <div className="grid gap-3 md:grid-cols-3">
                <Field label="Nombre completo">
                  <Input value={client.name} onChange={(e) => setClient({ ...client, name: e.target.value })} />
                </Field>
                <Field label="Correo">
                  <Input type="email" value={client.mail} onChange={(e) => setClient({ ...client, mail: e.target.value })} />
                </Field>
                <Field label="Teléfono" hint="Formato internacional, ej. +573001234567">
                  <Input value={client.phone} onChange={(e) => setClient({ ...client, phone: e.target.value })} />
                </Field>
              </div>

              <Button disabled={!canStart || busy} onClick={handleStart}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Iniciar sesión
              </Button>
            </div>
          ) : null}

          {phase !== "setup" ? (
            <div className="flex flex-wrap items-center gap-2">
              <StepBadge label="Documento" done={Boolean(acuantResult)} active={phase === "document"} />
              <StepBadge label="Prueba de vida" done={Boolean(facetecResult)} active={phase === "liveness"} />
              <StepBadge label="Guardado" done={phase === "done"} active={phase === "completing"} />
            </div>
          ) : null}

          {phase === "document" ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <IdCard className="h-5 w-5 text-primary" />
                <h2 className="text-sm font-semibold">Captura de documento (Acuant)</h2>
              </div>
              <p className="text-xs text-muted-foreground">
                Se abrirá el módulo de captura del documento. Al finalizar, se evalúa automáticamente el riesgo (NAAT-CHECK).
              </p>
              {checkStatus ? (
                <p className="text-xs text-muted-foreground">
                  Último intento: riesgo {checkStatus.risk} ({checkStatus.attemptsUsed}/{checkStatus.attemptsMax})
                </p>
              ) : null}
              <Button disabled={busy} onClick={handleCaptureDocument}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                {checkStatus ? "Volver a capturar" : "Iniciar captura de documento"}
              </Button>
            </div>
          ) : null}

          {phase === "liveness" ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Fingerprint className="h-5 w-5 text-primary" />
                <h2 className="text-sm font-semibold">Prueba de vida (Facetec)</h2>
              </div>
              <p className="text-xs text-muted-foreground">Documento aceptado. Ahora se verificará que hay una persona real frente a la cámara.</p>
              <Button disabled={busy} onClick={handleCaptureLiveness}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Iniciar prueba de vida
              </Button>
            </div>
          ) : null}

          {phase === "completing" ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-success" />
                <h2 className="text-sm font-semibold">Finalizar validación</h2>
              </div>
              <p className="text-xs text-muted-foreground">
                Se comparará el rostro del documento con la selfie, se cifrará la información y se guardará en FAD.
              </p>
              <Button disabled={busy} onClick={handleComplete}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Finalizar y guardar
              </Button>
            </div>
          ) : null}

          {phase === "done" && sdkInit ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-success">
                <CheckCircle2 className="h-5 w-5" />
                <h2 className="text-sm font-semibold">Validación completada</h2>
              </div>
              <Button onClick={() => navigate(`/executions/${sdkInit.executionId}`)}>Ver detalle de la validación</Button>
            </div>
          ) : null}

          {phase === "blocked" ? (
            <div className="flex items-center gap-2 text-destructive">
              <XCircle className="h-5 w-5" />
              <p className="text-sm">Se agotaron los intentos permitidos. Inicia una nueva sesión para volver a intentarlo.</p>
            </div>
          ) : null}

          {error && phase !== "blocked" ? (
            <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function StepBadge({ label, done, active }: { label: string; done: boolean; active: boolean }) {
  return <Badge tone={done ? "success" : active ? "info" : "neutral"}>{label}</Badge>;
}

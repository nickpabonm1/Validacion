import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, Fingerprint, IdCard, Loader2, Mail, RefreshCcw, Smartphone, User, XCircle } from "lucide-react";
import type { WebSdkSessionInitDto, WebSdkOnboardingMessagesDto, WebSdkShareLinkDto } from "@fad-console/shared-types";
import { DEFAULT_ONBOARDING_MESSAGES } from "@fad-console/validation-schemas";
import type { WebSdkAcuantResultInput, WebSdkFacetecResultInput } from "@fad-console/validation-schemas";
import { useEnvironments, useWebSdkConfig } from "../features/environments/useEnvironments";
import { useStartWebSdk, useSubmitAcuantResult, useSubmitFacetecResult, useCompleteWebSdk } from "../features/websdk/useWebSdk";
import { useCreateShareLink, useSendShareLink } from "../features/websdk/useWebSdkShare";
import { runAcuantCapture, runRegulaCapture, runFacetecCapture, describeSdkError } from "../lib/fad-sdk-client";
import { PageHeader, EmptyState, Spinner } from "../components/ui/misc";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Field } from "../builder/editors/Field";
import { Badge } from "../components/ui/badge";
import { ShareLinkPanel } from "../components/domain/ShareLinkPanel";
import { useToast } from "../components/ui/toast";

type Phase = "setup" | "document" | "liveness" | "completing" | "done" | "blocked" | "shared";
type CaptureMode = "self" | "share";

/** Onboarding sencillo de cara al cliente: cada paso muestra el título/texto configurado por el
 * operador en Ambientes → Web SDK → «Mensajes del onboarding» (nunca texto embebido en el
 * código), con un mensaje neutro por defecto mientras el ambiente no personalice nada. */
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
  const createShareLink = useCreateShareLink();
  const sendShareLink = useSendShareLink();

  const [phase, setPhase] = useState<Phase>("setup");
  const [captureMode, setCaptureMode] = useState<CaptureMode>("self");
  const [environmentId, setEnvironmentId] = useState(searchParams.get("environmentId") ?? "");
  const [client, setClient] = useState({ name: "", mail: "", phone: "" });
  const [sdkInit, setSdkInit] = useState<WebSdkSessionInitDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkStatus, setCheckStatus] = useState<{ attemptsUsed: number; attemptsMax: number; risk: string } | null>(null);
  const [acuantResult, setAcuantResult] = useState<WebSdkAcuantResultInput | null>(null);
  const [facetecResult, setFacetecResult] = useState<WebSdkFacetecResultInput | null>(null);
  const [shareLink, setShareLink] = useState<WebSdkShareLinkDto | null>(null);
  const [emailDestination, setEmailDestination] = useState("");

  const { data: webSdkConfig } = useWebSdkConfig(environmentId || undefined);
  const messages: WebSdkOnboardingMessagesDto = webSdkConfig?.onboardingMessages ?? DEFAULT_ONBOARDING_MESSAGES;

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

  /** Modo "enviar al cliente": crea el enlace compartible (QR/correo/WhatsApp) en vez de arrancar
   * la captura en este navegador — la ejecución se crea recién cuando el cliente abre el enlace
   * en su propio celular (ver websdk-share.service.ts en el backend). */
  async function handleCreateShareLink() {
    setError(null);
    setBusy(true);
    try {
      const res = await createShareLink.mutateAsync({ environmentId, client });
      setShareLink(res.shareLink);
      setEmailDestination(client.mail);
      setPhase("shared");
    } catch (e) {
      notify({ title: "No se pudo generar el enlace", description: (e as Error).message, tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function handleSendEmail() {
    if (!shareLink) return;
    try {
      await sendShareLink.mutateAsync({ id: shareLink.id, input: { channel: "EMAIL", destination: emailDestination } });
      notify({ title: "Enlace enviado por correo", description: emailDestination, tone: "success" });
    } catch (e) {
      notify({ title: "No se pudo enviar el correo", description: (e as Error).message, tone: "error" });
    }
  }

  async function handleCaptureDocument() {
    if (!sdkInit) return;
    setError(null);
    setBusy(true);
    try {
      const result = sdkInit.documentCaptureEngine === "REGULA" ? await runRegulaCapture(sdkInit) : await runAcuantCapture(sdkInit);
      setAcuantResult(result);
      const check = await submitAcuant.mutateAsync({ executionId: sdkInit.executionId, input: result });
      setCheckStatus({ attemptsUsed: check.attemptsUsed, attemptsMax: check.attemptsMax, risk: check.risk });
      if (check.accepted) {
        setPhase("liveness");
      } else if (check.exhausted) {
        setPhase("blocked");
        setError(messages.blockedBody);
      } else {
        setError(`${messages.documentRetryBody} (intento ${check.attemptsUsed}/${check.attemptsMax})`);
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
              {environmentId ? (
                <div>
                  <h2 className="text-lg font-semibold">{messages.welcomeTitle}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{messages.welcomeBody}</p>
                </div>
              ) : null}
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

              <h2 className="text-sm font-semibold">¿Quién realiza la captura?</h2>
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setCaptureMode("self")}
                  className={`flex items-center gap-2 rounded-lg border p-3 text-left text-sm transition-colors ${
                    captureMode === "self" ? "border-primary ring-1 ring-primary" : "border-border hover:bg-muted"
                  }`}
                >
                  <User className="h-4 w-4 shrink-0 text-primary" />
                  <span>
                    <span className="block font-medium">Yo mismo, en este equipo</span>
                    <span className="block text-xs text-muted-foreground">Usa la cámara de este navegador.</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setCaptureMode("share")}
                  className={`flex items-center gap-2 rounded-lg border p-3 text-left text-sm transition-colors ${
                    captureMode === "share" ? "border-primary ring-1 ring-primary" : "border-border hover:bg-muted"
                  }`}
                >
                  <Smartphone className="h-4 w-4 shrink-0 text-primary" />
                  <span>
                    <span className="block font-medium">Enviar al cliente</span>
                    <span className="block text-xs text-muted-foreground">Genera un enlace por QR, correo o WhatsApp.</span>
                  </span>
                </button>
              </div>

              <Button disabled={!canStart || busy} onClick={captureMode === "self" ? handleStart : handleCreateShareLink}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {captureMode === "self" ? "Iniciar sesión" : "Generar enlace"}
              </Button>
            </div>
          ) : null}

          {phase === "shared" && shareLink ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-primary" />
                <h2 className="text-lg font-semibold">Enlace generado</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                Comparte este enlace con {client.name || "el cliente"} para que complete la verificación desde su propio
                celular. Expira el {new Date(shareLink.expiresAt).toLocaleTimeString()} y solo puede usarse una vez.
              </p>
              <ShareLinkPanel url={shareLink.publicUrl ?? ""} processName={shareLink.processName ?? undefined} />
              <div className="flex flex-wrap items-end gap-2 rounded-lg border border-border p-4">
                <div className="min-w-[16rem] flex-1">
                  <Field label="Enviar por correo" htmlFor="share-email">
                    <Input
                      id="share-email"
                      type="email"
                      value={emailDestination}
                      onChange={(e) => setEmailDestination(e.target.value)}
                    />
                  </Field>
                </div>
                <Button type="button" variant="outline" disabled={!emailDestination || sendShareLink.isPending} onClick={handleSendEmail}>
                  {sendShareLink.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                  Enviar correo
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                El envío por WhatsApp desde el botón de arriba abre WhatsApp Web/app con el enlace ya redactado. Para envío
                automático vía la API de WhatsApp Business, configúrala en Configuración &gt; Mensajería.
              </p>
              <Button variant="ghost" onClick={() => navigate("/executions")}>
                Ver validaciones
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
                <h2 className="text-lg font-semibold">{messages.documentTitle}</h2>
              </div>
              <p className="text-sm text-muted-foreground">{checkStatus ? messages.documentRetryBody : messages.documentBody}</p>
              {checkStatus ? (
                <p className="text-xs text-muted-foreground">Intento {checkStatus.attemptsUsed}/{checkStatus.attemptsMax}</p>
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
                <h2 className="text-lg font-semibold">{messages.livenessTitle}</h2>
              </div>
              <p className="text-sm text-muted-foreground">{messages.livenessBody}</p>
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
                <h2 className="text-lg font-semibold">{messages.completingTitle}</h2>
              </div>
              <p className="text-sm text-muted-foreground">{messages.completingBody}</p>
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
                <h2 className="text-lg font-semibold">{messages.successTitle}</h2>
              </div>
              <p className="text-sm text-muted-foreground">{messages.successBody}</p>
              <Button onClick={() => navigate(`/executions/${sdkInit.executionId}`)}>Ver detalle de la validación</Button>
            </div>
          ) : null}

          {phase === "blocked" ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-destructive">
                <XCircle className="h-5 w-5" />
                <h2 className="text-lg font-semibold">{messages.blockedTitle}</h2>
              </div>
              <p className="text-sm text-destructive">{messages.blockedBody}</p>
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

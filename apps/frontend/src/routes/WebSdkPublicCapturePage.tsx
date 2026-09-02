import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, Fingerprint, IdCard, Loader2, ShieldHalf, XCircle } from "lucide-react";
import type { WebSdkSessionInitDto, WebSdkPublicShareInfoDto } from "@fad-console/shared-types";
import { DEFAULT_ONBOARDING_MESSAGES } from "@fad-console/validation-schemas";
import {
  usePublicShareAcuantResult,
  usePublicShareComplete,
  usePublicShareFacetecResult,
  usePublicShareInfo,
  usePublicShareStart,
} from "../features/websdk/useWebSdkShare";
import { runAcuantCapture, runRegulaCapture, runCaptureIdCapture, runFacetecCapture, describeSdkError } from "../lib/fad-sdk-client";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { FullPageSpinner } from "../components/layout/FullPageSpinner";

type Phase = "welcome" | "document" | "liveness" | "completing" | "done" | "blocked" | "error";

/**
 * Página pública (SIN sesión de esta consola) que abre el cliente final desde el QR/correo/
 * WhatsApp compartido en `WebSdkCapturePage` — ver `websdk-share-public.routes.ts`. El `token` de
 * la URL es la única credencial: opaco, de un solo uso, con expiración corta. Reutiliza el mismo
 * `fad-sdk-client.ts` que la captura hecha por un operador — solo cambia de dónde vienen los
 * datos (del enlace, no de un formulario) y que las llamadas al backend no llevan cookie.
 */
export function WebSdkPublicCapturePage() {
  const { token = "" } = useParams<{ token: string }>();
  const infoQuery = usePublicShareInfo();
  const startShare = usePublicShareStart();
  const submitAcuant = usePublicShareAcuantResult();
  const submitFacetec = usePublicShareFacetecResult();
  const completeShare = usePublicShareComplete();

  const [phase, setPhase] = useState<Phase>("welcome");
  const [info, setInfo] = useState<WebSdkPublicShareInfoDto | null>(null);
  const [sdkInit, setSdkInit] = useState<WebSdkSessionInitDto | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkStatus, setCheckStatus] = useState<{ attemptsUsed: number; attemptsMax: number } | null>(null);

  useEffect(() => {
    infoQuery
      .mutateAsync(token)
      .then((res) => {
        setInfo(res.info);
        if (res.info.status === "COMPLETED") setPhase("done");
      })
      .catch((e) => {
        setError((e as Error).message);
        setPhase("error");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const messages = info?.onboardingMessages ?? DEFAULT_ONBOARDING_MESSAGES;

  async function handleStart() {
    setError(null);
    setBusy(true);
    try {
      const res = await startShare.mutateAsync(token);
      setSdkInit(res.sdkInit);
      setPhase("document");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleCaptureDocument() {
    if (!sdkInit) return;
    setError(null);
    setBusy(true);
    try {
      const result =
        sdkInit.documentCaptureEngine === "REGULA"
          ? await runRegulaCapture(sdkInit)
          : sdkInit.documentCaptureEngine === "CAPTURE_ID"
            ? await runCaptureIdCapture(sdkInit)
            : await runAcuantCapture(sdkInit);
      const check = await submitAcuant.mutateAsync({ token, input: result });
      setCheckStatus({ attemptsUsed: check.attemptsUsed, attemptsMax: check.attemptsMax });
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
      await submitFacetec.mutateAsync({ token, input: result });
      setPhase("completing");
    } catch (e) {
      setError(describeSdkError(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleComplete() {
    setError(null);
    setBusy(true);
    try {
      await completeShare.mutateAsync(token);
      setPhase("done");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (infoQuery.isPending && !info && phase !== "error") return <FullPageSpinner />;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-md">
        <CardHeader className="items-center text-center">
          <ShieldHalf className="mb-2 h-8 w-8 text-primary" />
          <CardTitle>{info?.processName ?? "Verificación de identidad"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {phase === "welcome" ? (
            <div className="space-y-3 text-center">
              <h2 className="text-lg font-semibold">{messages.welcomeTitle}</h2>
              <p className="text-sm text-muted-foreground">{messages.welcomeBody}</p>
              <Button className="w-full" disabled={busy} onClick={handleStart}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Comenzar
              </Button>
            </div>
          ) : null}

          {phase === "document" ? (
            <div className="space-y-3 text-center">
              <IdCard className="mx-auto h-8 w-8 text-primary" />
              <h2 className="text-lg font-semibold">{messages.documentTitle}</h2>
              <p className="text-sm text-muted-foreground">{checkStatus ? messages.documentRetryBody : messages.documentBody}</p>
              {checkStatus ? (
                <p className="text-xs text-muted-foreground">Intento {checkStatus.attemptsUsed}/{checkStatus.attemptsMax}</p>
              ) : null}
              <Button className="w-full" disabled={busy} onClick={handleCaptureDocument}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {checkStatus ? "Volver a capturar" : "Tomar foto del documento"}
              </Button>
            </div>
          ) : null}

          {phase === "liveness" ? (
            <div className="space-y-3 text-center">
              <Fingerprint className="mx-auto h-8 w-8 text-primary" />
              <h2 className="text-lg font-semibold">{messages.livenessTitle}</h2>
              <p className="text-sm text-muted-foreground">{messages.livenessBody}</p>
              <Button className="w-full" disabled={busy} onClick={handleCaptureLiveness}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Iniciar prueba de vida
              </Button>
            </div>
          ) : null}

          {phase === "completing" ? (
            <div className="space-y-3 text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-success" />
              <h2 className="text-lg font-semibold">{messages.completingTitle}</h2>
              <p className="text-sm text-muted-foreground">{messages.completingBody}</p>
              <Button className="w-full" disabled={busy} onClick={handleComplete}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Finalizar
              </Button>
            </div>
          ) : null}

          {phase === "done" ? (
            <div className="space-y-2 text-center text-success">
              <CheckCircle2 className="mx-auto h-8 w-8" />
              <h2 className="text-lg font-semibold">{messages.successTitle}</h2>
              <p className="text-sm text-muted-foreground">{messages.successBody}</p>
            </div>
          ) : null}

          {phase === "blocked" ? (
            <div className="space-y-2 text-center text-destructive">
              <XCircle className="mx-auto h-8 w-8" />
              <h2 className="text-lg font-semibold">{messages.blockedTitle}</h2>
              <p className="text-sm">{messages.blockedBody}</p>
            </div>
          ) : null}

          {phase === "error" ? (
            <div className="space-y-2 text-center text-destructive">
              <XCircle className="mx-auto h-8 w-8" />
              <h2 className="text-lg font-semibold">No se pudo abrir este enlace</h2>
              <p className="text-sm">{error}</p>
            </div>
          ) : null}

          {error && phase !== "blocked" && phase !== "error" ? (
            <p className="rounded-md bg-destructive/10 p-3 text-center text-sm text-destructive">{error}</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

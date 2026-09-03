import { useEffect, useState } from "react";
import { toDataURL } from "qrcode";
import { Copy, ExternalLink, Loader2, Mail, MessageCircle, Share2 } from "lucide-react";
import { Button } from "../ui/button";
import { Field } from "../../builder/editors/Field";
import { Input } from "../ui/input";
import { useToast } from "../ui/toast";
import { useSendExecutionEmail } from "../../features/executions/useExecutions";

const canUseNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

/**
 * Enlace público para que el cliente final realice el proceso de validación (generado a partir de
 * `launchUrlTemplate` del ambiente, ver `lib/launch-url.ts`), listo para compartir por código QR,
 * WhatsApp o cualquier otro canal (compartir nativo del sistema operativo, o copiar el enlace).
 *
 * `executionId` es opcional: cuando se pasa (flujo API_BY_STEPS, ver `ExecutionDetailPage`/
 * `NewExecutionPage`), habilita el envío por correo con la plantilla propia del cliente
 * (`POST /executions/:id/send-email`) — el flujo Web SDK ya tiene su propio envío en
 * `WebSdkCapturePage`, por eso ese caller no pasa `executionId`.
 */
export function ShareLinkPanel({
  url,
  processName,
  executionId,
  defaultEmail,
}: {
  url: string;
  processName?: string;
  executionId?: string;
  defaultEmail?: string;
}) {
  const { notify } = useToast();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [emailDestination, setEmailDestination] = useState(defaultEmail ?? "");
  const sendEmail = useSendExecutionEmail();

  useEffect(() => {
    if (defaultEmail) setEmailDestination(defaultEmail);
  }, [defaultEmail]);

  useEffect(() => {
    let cancelled = false;
    toDataURL(url, { margin: 1, width: 176 })
      .then((dataUrl) => {
        if (!cancelled) setQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  function copyLink() {
    void navigator.clipboard.writeText(url);
    notify({ title: "Enlace copiado al portapapeles", tone: "info" });
  }

  const whatsappHref = `https://api.whatsapp.com/send?text=${encodeURIComponent(
    `Completa tu proceso de validación aquí: ${url}`,
  )}`;

  async function shareOther() {
    try {
      await navigator.share({
        title: processName ?? "Proceso de validación",
        text: "Completa tu proceso de validación en el siguiente enlace.",
        url,
      });
    } catch {
      // El usuario canceló el cuadro de compartir del sistema operativo: no es un error a reportar.
    }
  }

  async function handleSendEmail() {
    if (!executionId || !emailDestination) return;
    try {
      await sendEmail.mutateAsync({ id: executionId, to: emailDestination, publicUrl: url });
      notify({ title: "Correo enviado", tone: "success" });
    } catch (error) {
      notify({ title: "No se pudo enviar el correo", description: error instanceof Error ? error.message : undefined, tone: "error" });
    }
  }

  return (
    <div className="rounded-lg border border-border p-4">
      <p className="mb-3 text-sm font-medium">Enlace para el cliente</p>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex h-[9.5rem] w-[9.5rem] shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-white">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="Código QR del enlace de validación" className="h-full w-full" />
          ) : (
            <span className="px-2 text-center text-[11px] text-muted-foreground">Generando QR…</span>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex items-center gap-2">
            <Input
              readOnly
              value={url}
              className="font-mono text-xs"
              onFocus={(e) => e.currentTarget.select()}
              aria-label="Enlace de validación"
            />
            <Button type="button" variant="outline" size="sm" onClick={copyLink} aria-label="Copiar enlace">
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => window.open(whatsappHref, "_blank", "noopener,noreferrer")}
            >
              <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
            </Button>
            {canUseNativeShare ? (
              <Button type="button" variant="outline" size="sm" onClick={() => void shareOther()}>
                <Share2 className="h-3.5 w-3.5" /> Otro canal
              </Button>
            ) : null}
            <Button type="button" variant="outline" size="sm" onClick={() => window.open(url, "_blank", "noopener,noreferrer")}>
              <ExternalLink className="h-3.5 w-3.5" /> Abrir proceso
            </Button>
          </div>

          {executionId ? (
            <div className="flex flex-wrap items-end gap-2 border-t border-border pt-3">
              <div className="min-w-[16rem] flex-1">
                <Field label="Enviar por correo" htmlFor="share-link-email">
                  <Input
                    id="share-link-email"
                    type="email"
                    value={emailDestination}
                    onChange={(e) => setEmailDestination(e.target.value)}
                    placeholder="cliente@correo.com"
                  />
                </Field>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!emailDestination || sendEmail.isPending}
                onClick={() => void handleSendEmail()}
              >
                {sendEmail.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
                Enviar correo
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

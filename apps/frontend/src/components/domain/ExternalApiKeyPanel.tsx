import { useState } from "react";
import { Copy, KeyRound, Loader2, RefreshCcw, ShieldAlert, Trash2 } from "lucide-react";
import type { ApiEnvironmentDto } from "@fad-console/shared-types";
import { useGenerateExternalApiKey, useRevokeExternalApiKey } from "../../features/environments/useEnvironments";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { EmptyState } from "../ui/misc";
import { useToast } from "../ui/toast";

/**
 * Clave de API para que un SISTEMA EXTERNO (no un operador de esta consola, no el cliente final)
 * cree por su cuenta una "validación completa" que por detrás usa el Web SDK ya configurado en
 * este ambiente: crea el enlace de captura y lo entrega a su propio usuario, quien completa todo
 * el flujo (documento + prueba de vida) sin que un operador vuelva a intervenir — ver
 * `websdk-external.routes.ts`. La clave real solo se muestra UNA vez, al generarla o rotarla:
 * después solo se guarda su hash, nunca se puede volver a consultar.
 */
export function ExternalApiKeyPanel({ environment }: { environment: ApiEnvironmentDto | null }) {
  const generate = useGenerateExternalApiKey();
  const revoke = useRevokeExternalApiKey();
  const { notify } = useToast();
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const createUrl = `${origin}/api/public/websdk-validations`;

  if (!environment) {
    return (
      <EmptyState
        title="Guarda el ambiente primero"
        description="Crea el ambiente en «Datos generales» antes de generar una clave de API externa."
      />
    );
  }
  const { externalApiKey } = environment;
  const environmentId = environment.id;

  async function handleGenerate() {
    try {
      const apiKey = await generate.mutateAsync(environmentId);
      setRevealedKey(apiKey.rawKey);
      notify({ title: externalApiKey.configured ? "Clave rotada" : "Clave generada", tone: "success" });
    } catch (error) {
      notify({ title: "No se pudo generar la clave", description: error instanceof Error ? error.message : undefined, tone: "error" });
    }
  }

  async function handleRevoke() {
    try {
      await revoke.mutateAsync(environmentId);
      setRevealedKey(null);
      notify({ title: "Clave revocada", tone: "success" });
    } catch (error) {
      notify({ title: "No se pudo revocar la clave", description: error instanceof Error ? error.message : undefined, tone: "error" });
    }
  }

  function copy(value: string) {
    void navigator.clipboard.writeText(value);
    notify({ title: "Copiado al portapapeles", tone: "info" });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Validación completa por API externa</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Un sistema externo puede crear por su cuenta una validación que usa el Web SDK ya configurado en este
          ambiente: llama al endpoint de abajo con esta clave, recibe un enlace de captura, y se lo entrega a su
          usuario — quien completa todo el proceso (documento y prueba de vida) sin que nadie de esta consola
          intervenga. La ejecución resultante aparece igual que cualquier otra en Validaciones.
        </p>

        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 shrink-0 text-muted-foreground" />
          {externalApiKey.configured ? (
            <Badge tone="success">Clave activa{externalApiKey.prefix ? `: ${externalApiKey.prefix}` : ""}</Badge>
          ) : (
            <Badge tone="neutral">Sin clave configurada</Badge>
          )}
        </div>
        {externalApiKey.createdAt ? (
          <p className="text-xs text-muted-foreground">
            Generada el {new Date(externalApiKey.createdAt).toLocaleString()}
            {externalApiKey.lastUsedAt ? ` · Último uso: ${new Date(externalApiKey.lastUsedAt).toLocaleString()}` : " · Nunca se ha usado"}
          </p>
        ) : null}

        {revealedKey ? (
          <div className="space-y-1.5 rounded-md border border-warning/30 bg-warning/5 p-3">
            <div className="flex items-center gap-1.5 text-xs font-medium text-warning">
              <ShieldAlert className="h-3.5 w-3.5" /> Copia esta clave ahora: no se puede volver a mostrar.
            </div>
            <div className="flex items-center gap-2">
              <Input readOnly value={revealedKey} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
              <Button type="button" variant="outline" size="sm" onClick={() => copy(revealedKey)} aria-label="Copiar clave">
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={generate.isPending} onClick={() => void handleGenerate()}>
            {generate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            {externalApiKey.configured ? "Rotar clave" : "Generar clave"}
          </Button>
          {externalApiKey.configured ? (
            <Button type="button" variant="outline" disabled={revoke.isPending} onClick={() => void handleRevoke()}>
              {revoke.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Revocar
            </Button>
          ) : null}
        </div>

        <div className="space-y-1.5 border-t border-border pt-3">
          <p className="text-xs font-medium text-muted-foreground">Ejemplo de uso (crear una validación)</p>
          <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
            {`curl -X POST '${createUrl}' \\
  -H 'Authorization: Bearer <clave>' \\
  -H 'Content-Type: application/json' \\
  -d '{"webSdkTemplateId":"(opcional, ver Plantillas Web SDK)","client":{"name":"Nombre","mail":"correo@ejemplo.com","phone":"+573000000000"}}'`}
          </pre>
          <p className="text-xs text-muted-foreground">
            <code>webSdkTemplateId</code> es opcional: si se envía, esa validación usa los textos/tema/umbrales de esa
            plantilla (ver «Plantillas Web SDK» en el menú) en vez de la configuración general del ambiente.
          </p>
          <p className="text-xs text-muted-foreground">
            La respuesta trae <code>publicUrl</code>: es el enlace que se le entrega al usuario final para que
            complete la captura. Con <code>GET {createUrl}/&#123;id&#125;</code> (misma clave) se consulta el
            estado mientras tanto (<code>PENDING</code> → <code>STARTED</code> → <code>COMPLETED</code>). Una
            vez <code>COMPLETED</code>, esa misma respuesta trae el resultado completo en{" "}
            <code>detail</code> — OCR, validación de documento, alertas, clasificación y comparación facial:
            la misma información que ve un operador en el reporte de esta consola, sin necesidad de volver a
            consultar nada más.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

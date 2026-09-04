import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, XCircle } from "lucide-react";
import { NaatCheckConfigInputSchema, type NaatCheckConfigInput } from "@fad-console/validation-schemas";
import type { NaatCheckConfigDto } from "@fad-console/shared-types";
import { useNaatCheckConfig, useUpdateNaatCheckConfig, useTestNaatCheckConnection } from "../../features/environments/useEnvironments";
import { Card, CardContent } from "../ui/card";
import { Input } from "../ui/input";
import { Select } from "../ui/select";
import { Button } from "../ui/button";
import { Field, InlineSwitchField } from "../../builder/editors/Field";
import { CredentialInput } from "./CredentialInput";
import { EmptyState, Skeleton } from "../ui/misc";
import { useToast } from "../ui/toast";

const BLANK: NaatCheckConfigInput = {
  enabled: false,
  baseUrl: "https://uat.firmaautografa.com",
  username: "",
  password: "",
  acceptedRiskLevel: "LOW",
  webhookUsername: "",
  webhookPassword: "",
};

function toFormValues(config: NaatCheckConfigDto): NaatCheckConfigInput {
  return {
    enabled: config.enabled,
    baseUrl: config.baseUrl,
    username: config.username ?? "",
    password: "",
    acceptedRiskLevel: config.acceptedRiskLevel,
    webhookUsername: "",
    webhookPassword: "",
  };
}

/**
 * Configuración de NAAT-CHECK (NAAT.TECH "API RECHECK PROCESS") para el ambiente — un servicio
 * EXTERNO a FAD con su propio usuario/contraseña, que reevalúa el riesgo de un documento ya
 * capturado bajo pedido (botón "Reevaluar con NAAT-CHECK" en el detalle de una ejecución). Solo
 * aplica a ambientes API_BY_STEPS — el flujo Web SDK ya tiene su propio NAAT-CHECK integrado.
 */
export function NaatCheckConfigForm({ environmentId }: { environmentId: string | null }) {
  const { data: config, isLoading } = useNaatCheckConfig(environmentId ?? undefined);
  const updateConfig = useUpdateNaatCheckConfig();
  const testConnection = useTestNaatCheckConnection();
  const { notify } = useToast();
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const { register, handleSubmit, reset, setValue, watch, formState } = useForm<NaatCheckConfigInput>({
    resolver: zodResolver(NaatCheckConfigInputSchema),
    defaultValues: BLANK,
  });

  useEffect(() => {
    reset(config ? toFormValues(config) : BLANK);
    setTestResult(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  const values = watch();

  if (!environmentId) {
    return <EmptyState title="Guarda el ambiente primero" description="Crea el ambiente en «Datos generales» antes de configurar NAAT-CHECK." />;
  }
  if (isLoading) return <Skeleton className="h-64" />;

  const envId = environmentId;

  async function onSubmit(input: NaatCheckConfigInput) {
    try {
      await updateConfig.mutateAsync({ environmentId: envId, input });
      notify({ title: "Configuración de NAAT-CHECK guardada", tone: "success" });
    } catch (error) {
      notify({ title: "Error al guardar", description: (error as Error).message, tone: "error" });
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Card>
        <CardContent className="grid gap-4 p-5 md:grid-cols-2">
          <p className="text-xs text-muted-foreground md:col-span-2">
            NAAT-CHECK (NAAT.TECH) es un servicio independiente del proveedor de biometría, con su propio usuario y contraseña — nunca comparte
            credenciales con la conexión API de este ambiente. El recheck disparado desde aquí siempre es una consulta real
            y síncrona: nunca se fabrica un resultado.
          </p>
          <InlineSwitchField label="Habilitar NAAT-CHECK para este ambiente" checked={values.enabled} onChange={(v) => setValue("enabled", v)} />
          <Field label="Nivel de riesgo aceptado" htmlFor="acceptedRiskLevel" hint="Un resultado con riesgo mayor a este se marca como fallo en el reporte/puntuación.">
            <Select id="acceptedRiskLevel" {...register("acceptedRiskLevel")}>
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
            </Select>
          </Field>
          <Field label="URL base" htmlFor="baseUrl" hint="UAT: https://uat.firmaautografa.com. Producción: la que te asigne tu DM de NAAT.TECH.">
            <Input id="baseUrl" {...register("baseUrl")} />
          </Field>
          <div />
          <CredentialInput
            id="username"
            label="Usuario NAAT-CHECK"
            configured={Boolean(config?.username)}
            value={values.username ?? ""}
            onChange={(v) => setValue("username", v)}
          />
          <CredentialInput
            id="password"
            label="Contraseña NAAT-CHECK"
            configured={config?.passwordConfigured ?? false}
            value={values.password ?? ""}
            onChange={(v) => setValue("password", v)}
            hint="Se hashea con SHA-256 antes de enviarse (nunca en texto plano)."
          />
          <CredentialInput
            id="webhookUsername"
            label="Usuario del webhook (para NAAT-CHECK)"
            configured={config?.webhookUsernameConfigured ?? false}
            value={values.webhookUsername ?? ""}
            onChange={(v) => setValue("webhookUsername", v)}
            hint="Credenciales que le entregas a NAAT-CHECK para llamar de vuelta a /api/webhooks/naat-check."
          />
          <CredentialInput
            id="webhookPassword"
            label="Contraseña del webhook (para NAAT-CHECK)"
            configured={config?.webhookPasswordConfigured ?? false}
            value={values.webhookPassword ?? ""}
            onChange={(v) => setValue("webhookPassword", v)}
          />
          <div className="flex items-end gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={testConnection.isPending}
              onClick={async () => {
                const res = await testConnection.mutateAsync({
                  environmentId: envId,
                  input: { baseUrl: values.baseUrl, username: values.username, password: values.password },
                });
                setTestResult(res);
              }}
            >
              Probar conexión
            </Button>
          </div>
          {testResult ? (
            <div
              className={`md:col-span-2 flex items-center gap-2 rounded-md p-3 text-sm ${
                testResult.success ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
              }`}
            >
              {testResult.success ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              {testResult.message}
            </div>
          ) : null}
        </CardContent>
      </Card>
      <div className="mt-4 flex justify-end">
        <Button type="submit" disabled={formState.isSubmitting}>
          Guardar configuración de NAAT-CHECK
        </Button>
      </div>
    </form>
  );
}

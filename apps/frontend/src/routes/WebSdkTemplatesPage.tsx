import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { WebSdkTemplateInputSchema, type WebSdkTemplateInput } from "@fad-console/validation-schemas";
import type { WebSdkTemplateDto } from "@fad-console/shared-types";
import { useEnvironments } from "../features/environments/useEnvironments";
import {
  useWebSdkTemplates,
  useCreateWebSdkTemplate,
  useUpdateWebSdkTemplate,
  useDeleteWebSdkTemplate,
} from "../features/websdk/useWebSdkTemplates";
import { readFadCustomization, writeFadCustomization, parseConfigurationJson } from "../lib/websdk-design";
import { PageHeader, EmptyState, Skeleton } from "../components/ui/misc";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input, Textarea } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Field, InlineSwitchField } from "../builder/editors/Field";
import { WebSdkDesignEditor } from "../components/domain/WebSdkDesignEditor";
import { useToast } from "../components/ui/toast";

const BLANK: WebSdkTemplateInput = {
  name: "",
  description: undefined,
  environmentId: "",
  active: true,
  onboardingMessages: {},
  customization: {},
  checkMaxAttempts: null,
  checkAcceptedRisk: null,
  faceMatchMinConfidence: null,
};

function toFormValues(template: WebSdkTemplateDto): WebSdkTemplateInput {
  return {
    name: template.name,
    description: template.description ?? undefined,
    environmentId: template.environmentId,
    active: template.active,
    onboardingMessages: template.onboardingMessages,
    customization: template.customization,
    checkMaxAttempts: template.checkMaxAttempts,
    checkAcceptedRisk: template.checkAcceptedRisk,
    faceMatchMinConfidence: template.faceMatchMinConfidence,
  };
}

/** Quita las claves con string vacío — un campo de texto que el operador dejó en blanco significa
 * "no cambiar nada aquí", nunca "sobreescribir con texto vacío" (ver `resolveEffectiveSettings`
 * en el backend: hace falta que la clave esté AUSENTE para que se use lo del ambiente). */
function pruneEmptyStrings<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const result: Partial<T> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string" && value.trim() === "") continue;
    result[key as keyof T] = value as T[keyof T];
  }
  return result;
}

/** Un campo numérico vacío significa "usa el del ambiente" (`null`), nunca `0` — `Number("")`
 * evalúa a `0` en JS, así que hay que interceptar la cadena vacía explícitamente antes de
 * convertir. */
function parseOptionalNumber(raw: unknown): number | null {
  if (raw === "" || raw === null || raw === undefined) return null;
  const value = Number(raw);
  return Number.isNaN(value) ? null : value;
}

/**
 * Plantillas del modelo Web SDK — el equivalente de "Plantillas" (Constructor) para API-by-steps,
 * pero con su propia forma: solo cubre lo que puede variar por proceso sin credenciales (textos
 * de cada pantalla, tema/colores, umbrales de intentos/riesgo/confianza). El motor de documento y
 * las credenciales siguen siendo del ambiente (ver Ambientes > Web SDK) — una plantilla nunca las
 * toca. Sección separada del Constructor de by-steps porque la forma de configuración es distinta.
 */
export function WebSdkTemplatesPage() {
  const { data: environments = [], isLoading: loadingEnvironments } = useEnvironments();
  const webSdkEnvironments = environments.filter((e) => e.integrationModel === "WEB_SDK");
  const [environmentId, setEnvironmentId] = useState<string>("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { notify } = useToast();

  useEffect(() => {
    if (!environmentId && webSdkEnvironments.length > 0) setEnvironmentId(webSdkEnvironments[0]!.id);
  }, [environmentId, webSdkEnvironments]);

  const { data: templates = [], isLoading: loadingTemplates } = useWebSdkTemplates(environmentId || undefined);
  const selected = templates.find((t) => t.id === selectedId) ?? null;
  const createTemplate = useCreateWebSdkTemplate();
  const updateTemplate = useUpdateWebSdkTemplate();
  const deleteTemplate = useDeleteWebSdkTemplate();

  const { register, handleSubmit, reset, watch, formState } = useForm<WebSdkTemplateInput>({
    resolver: zodResolver(WebSdkTemplateInputSchema),
    defaultValues: { ...BLANK, environmentId },
  });
  const [customizationText, setCustomizationText] = useState("{}");

  useEffect(() => {
    const values = selected ? toFormValues(selected) : { ...BLANK, environmentId };
    reset(values);
    setCustomizationText(writeFadCustomization("{}", values.customization ?? {}));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, environmentId]);

  const values = watch();

  async function onSubmit(formValues: WebSdkTemplateInput) {
    const customization = readFadCustomization(parseConfigurationJson(customizationText));
    const payload: WebSdkTemplateInput = {
      ...formValues,
      environmentId,
      onboardingMessages: pruneEmptyStrings(formValues.onboardingMessages ?? {}),
      customization,
    };
    try {
      if (selected) {
        await updateTemplate.mutateAsync({ id: selected.id, input: payload });
        notify({ title: "Plantilla actualizada", tone: "success" });
      } else {
        const res = await createTemplate.mutateAsync(payload);
        notify({ title: "Plantilla creada", tone: "success" });
        setSelectedId(res.template.id);
      }
    } catch (error) {
      notify({ title: "Error al guardar", description: (error as Error).message, tone: "error" });
    }
  }

  async function handleDelete(template: WebSdkTemplateDto) {
    if (!window.confirm(`¿Eliminar la plantilla «${template.name}»? Las ejecuciones ya creadas con ella no se ven afectadas.`)) return;
    try {
      await deleteTemplate.mutateAsync({ id: template.id, environmentId: template.environmentId });
      if (selectedId === template.id) setSelectedId(null);
      notify({ title: "Plantilla eliminada", tone: "success" });
    } catch (error) {
      notify({ title: "No se pudo eliminar", description: (error as Error).message, tone: "error" });
    }
  }

  const previewPayload = {
    ...values,
    environmentId,
    onboardingMessages: pruneEmptyStrings(values.onboardingMessages ?? {}),
    customization: readFadCustomization(parseConfigurationJson(customizationText)),
  };

  return (
    <div>
      <PageHeader
        title="Plantillas Web SDK"
        description="Textos, tema y umbrales reutilizables para el flujo de captura embebida — el motor de documento y las credenciales siguen siendo del ambiente."
      />

      <div className="mb-4 max-w-sm">
        <Field label="Ambiente Web SDK">
          {loadingEnvironments ? (
            <Skeleton className="h-9" />
          ) : webSdkEnvironments.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No hay ambientes con modelo Web SDK. Crea uno en Ambientes primero.
            </p>
          ) : (
            <Select
              value={environmentId}
              onChange={(e) => {
                setEnvironmentId(e.target.value);
                setSelectedId(null);
              }}
            >
              {webSdkEnvironments.map((env) => (
                <option key={env.id} value={env.id}>
                  {env.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      {!environmentId ? null : (
        <div className="grid grid-cols-[280px_1fr] gap-6">
          <div className="space-y-2">
            <Button variant="outline" className="w-full" onClick={() => setSelectedId(null)}>
              <Plus className="h-4 w-4" /> Nueva plantilla
            </Button>
            {loadingTemplates ? (
              <Skeleton className="h-24" />
            ) : templates.length === 0 ? (
              <EmptyState title="Sin plantillas" description="Crea la primera para este ambiente." />
            ) : (
              templates.map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => setSelectedId(tpl.id)}
                  className={`block w-full rounded-lg border p-3 text-left ${
                    selectedId === tpl.id ? "border-primary ring-1 ring-primary" : "border-border hover:bg-muted"
                  }`}
                >
                  <p className="text-sm font-medium">{tpl.name}</p>
                  <Badge tone={tpl.active ? "success" : "neutral"} className="mt-1">
                    {tpl.active ? "Activa" : "Inactiva"}
                  </Badge>
                </button>
              ))
            )}
          </div>

          <div className="space-y-4">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Datos generales</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <Field label="Nombre" htmlFor="name">
                    <Input id="name" {...register("name")} />
                  </Field>
                  <Field label="Descripción" htmlFor="description">
                    <Input id="description" {...register("description")} />
                  </Field>
                  <InlineSwitchField
                    label="Plantilla activa"
                    checked={values.active}
                    onChange={(checked) => reset({ ...values, active: checked })}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Umbrales</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-3">
                  <Field label="Intentos máximos de NAAT-CHECK" htmlFor="checkMaxAttempts" hint="Vacío = usa el del ambiente">
                    <Input id="checkMaxAttempts" type="number" {...register("checkMaxAttempts", { setValueAs: parseOptionalNumber })} />
                  </Field>
                  <Field label="Riesgo aceptado" htmlFor="checkAcceptedRisk" hint="Vacío = usa el del ambiente">
                    <Select id="checkAcceptedRisk" {...register("checkAcceptedRisk", { setValueAs: (v) => (v === "" ? null : v) })}>
                      <option value="">(usar el del ambiente)</option>
                      <option value="LOW">LOW</option>
                      <option value="MEDIUM">MEDIUM</option>
                      <option value="HIGH">HIGH</option>
                    </Select>
                  </Field>
                  <Field label="Confianza mínima del match facial (%)" htmlFor="faceMatchMinConfidence" hint="Vacío = usa el del ambiente">
                    <Input id="faceMatchMinConfidence" type="number" {...register("faceMatchMinConfidence", { setValueAs: parseOptionalNumber })} />
                  </Field>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Tema / colores de marca</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="mb-3 text-xs text-muted-foreground">
                    Deja todo en blanco para usar el tema ya configurado en Ambientes &gt; Web SDK. Lo que fijes aquí
                    reemplaza por completo ese tema para las ejecuciones que usen esta plantilla.
                  </p>
                  <WebSdkDesignEditor moduleLabel="Plantilla" configurationText={customizationText} onConfigurationChange={setCustomizationText} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Mensajes del onboarding</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <p className="text-xs text-muted-foreground md:col-span-2">
                    Deja un campo en blanco para usar el mensaje ya configurado en el ambiente — solo lo que escribas
                    aquí reemplaza ese texto para esta plantilla.
                  </p>
                  <Field label="Bienvenida — título" htmlFor="welcomeTitle">
                    <Input id="welcomeTitle" {...register("onboardingMessages.welcomeTitle")} />
                  </Field>
                  <Field label="Bienvenida — texto" htmlFor="welcomeBody">
                    <Textarea id="welcomeBody" rows={2} {...register("onboardingMessages.welcomeBody")} />
                  </Field>
                  <Field label="Documento — título" htmlFor="documentTitle">
                    <Input id="documentTitle" {...register("onboardingMessages.documentTitle")} />
                  </Field>
                  <Field label="Documento — instrucciones" htmlFor="documentBody">
                    <Textarea id="documentBody" rows={2} {...register("onboardingMessages.documentBody")} />
                  </Field>
                  <Field label="Documento — mensaje al reintentar" htmlFor="documentRetryBody">
                    <Textarea id="documentRetryBody" rows={2} {...register("onboardingMessages.documentRetryBody")} />
                  </Field>
                  <div />
                  <Field label="Prueba de vida — título" htmlFor="livenessTitle">
                    <Input id="livenessTitle" {...register("onboardingMessages.livenessTitle")} />
                  </Field>
                  <Field label="Prueba de vida — instrucciones" htmlFor="livenessBody">
                    <Textarea id="livenessBody" rows={2} {...register("onboardingMessages.livenessBody")} />
                  </Field>
                  <Field label="Finalizando — título" htmlFor="completingTitle">
                    <Input id="completingTitle" {...register("onboardingMessages.completingTitle")} />
                  </Field>
                  <Field label="Finalizando — texto" htmlFor="completingBody">
                    <Textarea id="completingBody" rows={2} {...register("onboardingMessages.completingBody")} />
                  </Field>
                  <Field label="Éxito — título" htmlFor="successTitle">
                    <Input id="successTitle" {...register("onboardingMessages.successTitle")} />
                  </Field>
                  <Field label="Éxito — texto" htmlFor="successBody">
                    <Textarea id="successBody" rows={2} {...register("onboardingMessages.successBody")} />
                  </Field>
                  <Field label="Bloqueado — título" htmlFor="blockedTitle">
                    <Input id="blockedTitle" {...register("onboardingMessages.blockedTitle")} />
                  </Field>
                  <Field label="Bloqueado — texto" htmlFor="blockedBody">
                    <Textarea id="blockedBody" rows={2} {...register("onboardingMessages.blockedBody")} />
                  </Field>
                  <Field label="Error genérico" htmlFor="genericErrorBody">
                    <Textarea id="genericErrorBody" rows={2} {...register("onboardingMessages.genericErrorBody")} />
                  </Field>
                </CardContent>
              </Card>

              <div className="flex items-center justify-between gap-3">
                {selected ? (
                  <Button type="button" variant="outline" onClick={() => void handleDelete(selected)}>
                    <Trash2 className="h-4 w-4" /> Eliminar plantilla
                  </Button>
                ) : (
                  <span />
                )}
                <Button type="submit" disabled={formState.isSubmitting}>
                  {selected ? "Guardar cambios" : "Crear plantilla"}
                </Button>
              </div>
            </form>

            <Card>
              <CardHeader>
                <CardTitle>JSON de la plantilla</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="max-h-96 overflow-auto rounded-md bg-muted p-3 text-xs">{JSON.stringify(previewPayload, null, 2)}</pre>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

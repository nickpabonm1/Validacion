import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Upload } from "lucide-react";
import { WebSdkConfigInputSchema, DEFAULT_ONBOARDING_MESSAGES, type WebSdkConfigInput } from "@fad-console/validation-schemas";
import type { WebSdkConfigDto } from "@fad-console/shared-types";
import {
  useWebSdkConfig,
  useUpdateWebSdkConfig,
  useClearWebSdkCredential,
} from "../../features/environments/useEnvironments";
import { parseWebSdkConfigImport } from "../../lib/websdk-config-import";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input, Textarea } from "../ui/input";
import { Select } from "../ui/select";
import { Button } from "../ui/button";
import { Field, InlineSwitchField } from "../../builder/editors/Field";
import { CredentialInput } from "./CredentialInput";
import { EmptyState, Skeleton } from "../ui/misc";
import { useToast } from "../ui/toast";

const BLANK: WebSdkConfigInput = {
  sdkBaseUrl: "https://uathaapiframe.firmaautografa.com",
  sdkRequestId: undefined,
  documentCaptureEngine: "ACUANT",
  acuantAcasEndpoint: "https://eu.acas.acuant.net",
  acuantLivenessEndpoint: "https://eu.passlive.acuant.net",
  acuantAssureidEndpoint: "https://eu.assureid.acuant.net",
  acuantParams: { idData: true, idPhoto: true, manualCapture: false },
  acuantConfiguration: {},
  biometricEngine: "FACETEC",
  facetecUseMiddleware: true,
  facetecMiddleware: {},
  facetecConfiguration: {},
  checkEndpoint: "/naat-check-api/idholo/multiple",
  compareFacesEndpoint: "/biometrics/compareFacesPassive",
  getValidationKeysEndpoint: "/validation/validations/getValidationKeys",
  saveValidationDataEndpoint: "/validation/validations/saveValidationData",
  checkMaxAttempts: 3,
  checkAcceptedRisk: "LOW",
  faceMatchMinConfidence: 85,
  onboardingMessages: DEFAULT_ONBOARDING_MESSAGES,
};

function toFormValues(config: WebSdkConfigDto): WebSdkConfigInput {
  return {
    sdkBaseUrl: config.sdkBaseUrl,
    sdkRequestId: config.sdkRequestId ?? undefined,
    documentCaptureEngine: config.documentCaptureEngine,
    acuantAcasEndpoint: config.acuantAcasEndpoint,
    acuantLivenessEndpoint: config.acuantLivenessEndpoint,
    acuantAssureidEndpoint: config.acuantAssureidEndpoint,
    acuantParams: config.acuantParams,
    acuantConfiguration: config.acuantConfiguration,
    biometricEngine: config.biometricEngine,
    facetecUseMiddleware: config.facetecUseMiddleware,
    facetecMiddleware: config.facetecMiddleware,
    facetecConfiguration: config.facetecConfiguration,
    checkEndpoint: config.checkEndpoint,
    compareFacesEndpoint: config.compareFacesEndpoint,
    getValidationKeysEndpoint: config.getValidationKeysEndpoint,
    saveValidationDataEndpoint: config.saveValidationDataEndpoint,
    checkMaxAttempts: config.checkMaxAttempts,
    checkAcceptedRisk: config.checkAcceptedRisk,
    faceMatchMinConfidence: config.faceMatchMinConfidence,
    onboardingMessages: config.onboardingMessages,
  };
}

/** Textarea de JSON crudo (objetos CONFIGURATION/middleware de los SDK de terceros: no vale la
 * pena modelar cada campo posible de Acuant/Facetec como formulario — son objetos de
 * personalización visual del vendor, no secretos). Nunca usa `eval`; valida con `JSON.parse` al
 * guardar y avisa con un toast si el JSON es inválido, igual que el resto de imports JSON de la
 * consola (ver BuilderPage "Importar JSON"). */
function JsonBlobField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label} hint={hint}>
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={6} spellCheck={false} />
    </Field>
  );
}

export function WebSdkConfigForm({ environmentId }: { environmentId: string | null }) {
  const { data: config, isLoading } = useWebSdkConfig(environmentId ?? undefined);
  const updateConfig = useUpdateWebSdkConfig();
  const clearCredential = useClearWebSdkCredential();
  const { notify } = useToast();

  const { register, handleSubmit, reset, setValue, watch, formState } = useForm<WebSdkConfigInput>({
    resolver: zodResolver(WebSdkConfigInputSchema),
    defaultValues: BLANK,
  });

  const [acuantConfigurationText, setAcuantConfigurationText] = useState("{}");
  const [facetecMiddlewareText, setFacetecMiddlewareText] = useState("{}");
  const [facetecConfigurationText, setFacetecConfigurationText] = useState("{}");
  const [productionKeyTextJson, setProductionKeyTextJson] = useState("");
  const importFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const values = config ? toFormValues(config) : BLANK;
    reset(values);
    setAcuantConfigurationText(JSON.stringify(values.acuantConfiguration, null, 2));
    setFacetecMiddlewareText(JSON.stringify(values.facetecMiddleware, null, 2));
    setFacetecConfigurationText(JSON.stringify(values.facetecConfiguration, null, 2));
    setProductionKeyTextJson("");
  }, [config, reset]);

  const values = watch();

  if (!environmentId) {
    return <EmptyState title="Guarda el ambiente primero" description="Crea el ambiente en «Datos generales» antes de configurar Web SDK." />;
  }
  if (isLoading) return <Skeleton className="h-96" />;

  // Vinculado a una constante para que TypeScript conserve el tipo `string` (no `string | null`)
  // dentro de las funciones anidadas de más abajo.
  const envId = environmentId;

  /** Importa un archivo JSON de configuración Web SDK (ver docs/examples/websdk-config.example.json):
   * mismo shape que este formulario. Solo aplica los campos que el archivo trae explícitamente —
   * el resto del formulario queda intacto. Nunca se persiste hasta que el operador pulsa
   * «Guardar configuración Web SDK». */
  async function handleImportConfigFile(file: File) {
    try {
      const text = await file.text();
      const raw = JSON.parse(text);
      const result = parseWebSdkConfigImport(raw);

      for (const [key, value] of Object.entries(result.values) as [keyof WebSdkConfigInput, never][]) {
        if (key === "acuantConfiguration") setAcuantConfigurationText(JSON.stringify(value, null, 2));
        else if (key === "facetecMiddleware") setFacetecMiddlewareText(JSON.stringify(value, null, 2));
        else if (key === "facetecConfiguration") setFacetecConfigurationText(JSON.stringify(value, null, 2));
        else if (key === "facetecProductionKeyText") setProductionKeyTextJson(JSON.stringify(value));
        else setValue(key, value, { shouldDirty: true, shouldValidate: true });
      }

      notify({
        title: "Configuración Web SDK importada",
        description:
          `${result.matched.length} campo(s) completados desde «${file.name}». Revisa antes de guardar.` +
          (result.warnings.length > 0 ? ` ${result.warnings.join(" ")}` : ""),
        tone: result.warnings.length > 0 ? "warning" : "success",
      });
    } catch (error) {
      notify({
        title: "No se pudo importar el archivo",
        description: error instanceof Error ? error.message : "Archivo inválido",
        tone: "error",
      });
    }
  }

  function parseJsonBlob(label: string, text: string): Record<string, unknown> | null {
    if (!text.trim()) return {};
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("no es un objeto");
      return parsed as Record<string, unknown>;
    } catch {
      notify({ title: `JSON inválido en «${label}»`, description: "Revisa la sintaxis y vuelve a intentar.", tone: "error" });
      return null;
    }
  }

  async function onSubmit(formValues: WebSdkConfigInput) {
    const acuantConfiguration = parseJsonBlob("Configuración de Acuant", acuantConfigurationText);
    const facetecMiddleware = parseJsonBlob("Middleware de Facetec", facetecMiddlewareText);
    const facetecConfiguration = parseJsonBlob("Configuración de Facetec", facetecConfigurationText);
    if (acuantConfiguration === null || facetecMiddleware === null || facetecConfiguration === null) return;

    let facetecProductionKeyText: WebSdkConfigInput["facetecProductionKeyText"];
    if (productionKeyTextJson.trim()) {
      try {
        const parsed = JSON.parse(productionKeyTextJson);
        facetecProductionKeyText = { domains: parsed.domains ?? "", expiryDate: parsed.expiryDate ?? "", key: parsed.key ?? "" };
      } catch {
        notify({ title: "JSON inválido en «productionKeyText»", tone: "error" });
        return;
      }
    }

    try {
      await updateConfig.mutateAsync({
        environmentId: envId,
        input: { ...formValues, acuantConfiguration, facetecMiddleware, facetecConfiguration, facetecProductionKeyText },
      });
      notify({ title: "Configuración Web SDK guardada", tone: "success" });
      setProductionKeyTextJson("");
    } catch (error) {
      notify({ title: "Error al guardar", description: (error as Error).message, tone: "error" });
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 p-3">
        <p className="min-w-0 flex-1 text-xs text-muted-foreground">
          Sube un archivo JSON con credenciales/endpoints Web SDK en vez de escribirlos a mano — ver{" "}
          <code className="rounded bg-muted px-1 py-0.5">docs/examples/websdk-config.example.json</code> en el
          repositorio.
        </p>
        <input
          ref={importFileInputRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleImportConfigFile(file);
            e.target.value = "";
          }}
        />
        <Button type="button" variant="outline" size="sm" className="shrink-0 whitespace-nowrap" onClick={() => importFileInputRef.current?.click()}>
          <Upload className="h-4 w-4" /> Importar configuración (JSON)
        </Button>
      </div>

    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>SDK (iframe)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="URL base del SDK" htmlFor="sdkBaseUrl" hint="uathaapiframe.firmaautografa.com (UATHA) o apiframe.firmaautografa.com (PROD)">
            <Input id="sdkBaseUrl" {...register("sdkBaseUrl")} />
          </Field>
          <Field label="Request ID (métricas, opcional)" htmlFor="sdkRequestId">
            <Input id="sdkRequestId" {...register("sdkRequestId")} />
          </Field>
          <CredentialInput
            id="sdkToken"
            label="Token del SDK (Token generation)"
            configured={config?.sdkTokenConfigured ?? false}
            value={values.sdkToken ?? ""}
            onChange={(v) => setValue("sdkToken", v)}
            onClear={() => clearCredential.mutate({ environmentId: envId, field: "sdkToken" })}
            hint="Opcional: si se deja vacío, se usa el access_token OAuth como respaldo."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Captura de documento (Acuant)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Motor de captura" htmlFor="documentCaptureEngine">
            <Select id="documentCaptureEngine" {...register("documentCaptureEngine")}>
              <option value="ACUANT">Acuant</option>
            </Select>
          </Field>
          <div />
          <CredentialInput
            id="acuantPassiveUsername"
            label="Usuario Acuant"
            configured={config?.acuantPassiveUsernameConfigured ?? false}
            value={values.acuantPassiveUsername ?? ""}
            onChange={(v) => setValue("acuantPassiveUsername", v)}
            onClear={() => clearCredential.mutate({ environmentId: envId, field: "acuantPassiveUsername" })}
          />
          <CredentialInput
            id="acuantPassivePassword"
            label="Contraseña Acuant"
            configured={config?.acuantPassivePasswordConfigured ?? false}
            value={values.acuantPassivePassword ?? ""}
            onChange={(v) => setValue("acuantPassivePassword", v)}
            onClear={() => clearCredential.mutate({ environmentId: envId, field: "acuantPassivePassword" })}
          />
          <CredentialInput
            id="acuantPassiveSubscriptionId"
            label="Subscription ID Acuant"
            configured={config?.acuantPassiveSubscriptionIdConfigured ?? false}
            value={values.acuantPassiveSubscriptionId ?? ""}
            onChange={(v) => setValue("acuantPassiveSubscriptionId", v)}
            onClear={() => clearCredential.mutate({ environmentId: envId, field: "acuantPassiveSubscriptionId" })}
          />
          <Field label="Endpoint ACAS" htmlFor="acuantAcasEndpoint">
            <Input id="acuantAcasEndpoint" {...register("acuantAcasEndpoint")} />
          </Field>
          <Field label="Endpoint Liveness (Acuant)" htmlFor="acuantLivenessEndpoint">
            <Input id="acuantLivenessEndpoint" {...register("acuantLivenessEndpoint")} />
          </Field>
          <Field label="Endpoint AssureID" htmlFor="acuantAssureidEndpoint">
            <Input id="acuantAssureidEndpoint" {...register("acuantAssureidEndpoint")} />
          </Field>
          <div className="flex flex-col gap-2 md:col-span-2">
            <InlineSwitchField label="Extraer OCR (idData)" checked={values.acuantParams.idData} onChange={(v) => setValue("acuantParams", { ...values.acuantParams, idData: v })} />
            <InlineSwitchField label="Recortar rostro de la ID (idPhoto)" checked={values.acuantParams.idPhoto} onChange={(v) => setValue("acuantParams", { ...values.acuantParams, idPhoto: v })} />
            <InlineSwitchField label="Captura manual" checked={values.acuantParams.manualCapture} onChange={(v) => setValue("acuantParams", { ...values.acuantParams, manualCapture: v })} />
          </div>
          <div className="md:col-span-2">
            <JsonBlobField
              label="Configuración visual de Acuant (JSON)"
              hint="Objeto CONFIGURATION de startAcuant: colores, leyendas, vistas. No contiene secretos."
              value={acuantConfigurationText}
              onChange={setAcuantConfigurationText}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Prueba de vida (Facetec)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Motor biométrico" htmlFor="biometricEngine">
            <Select id="biometricEngine" {...register("biometricEngine")}>
              <option value="FACETEC">Facetec</option>
            </Select>
          </Field>
          <InlineSwitchField
            label="Usar middleware de FAD (recomendado)"
            checked={values.facetecUseMiddleware}
            onChange={(v) => setValue("facetecUseMiddleware", v)}
          />
          {values.facetecUseMiddleware ? (
            <div className="md:col-span-2">
              <JsonBlobField
                label="Descriptor del middleware (JSON)"
                hint="module, provider, platform, app, version, additionalInfo, options.baseUrl. El token se inyecta automáticamente."
                value={facetecMiddlewareText}
                onChange={setFacetecMiddlewareText}
              />
            </div>
          ) : (
            <>
              <CredentialInput
                id="facetecDeviceKeyIdentifier"
                label="Device Key Identifier"
                configured={config?.facetecDeviceKeyIdentifierConfigured ?? false}
                value={values.facetecDeviceKeyIdentifier ?? ""}
                onChange={(v) => setValue("facetecDeviceKeyIdentifier", v)}
                onClear={() => clearCredential.mutate({ environmentId: envId, field: "facetecDeviceKeyIdentifier" })}
              />
              <CredentialInput
                id="facetecPublicFaceScanEncryptionKey"
                label="Public FaceScan Encryption Key"
                configured={config?.facetecPublicFaceScanEncryptionKeyConfigured ?? false}
                value={values.facetecPublicFaceScanEncryptionKey ?? ""}
                onChange={(v) => setValue("facetecPublicFaceScanEncryptionKey", v)}
                onClear={() => clearCredential.mutate({ environmentId: envId, field: "facetecPublicFaceScanEncryptionKey" })}
              />
              <div className="md:col-span-2">
                <CredentialInput
                  id="facetecProductionKeyText"
                  label='productionKeyText (JSON: {"domains","expiryDate","key"})'
                  configured={config?.facetecProductionKeyTextConfigured ?? false}
                  value={productionKeyTextJson}
                  onChange={setProductionKeyTextJson}
                  onClear={() => clearCredential.mutate({ environmentId: envId, field: "facetecProductionKeyText" })}
                />
              </div>
            </>
          )}
          <div className="md:col-span-2">
            <JsonBlobField
              label="Configuración visual de Facetec (JSON)"
              hint="Objeto CONFIGURATION de startFacetec: colores, leyendas, vistas. No contiene secretos."
              value={facetecConfigurationText}
              onChange={setFacetecConfigurationText}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Endpoints y umbrales</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Endpoint NAAT-CHECK" htmlFor="checkEndpoint">
            <Input id="checkEndpoint" {...register("checkEndpoint")} />
          </Field>
          <Field label="Endpoint compareFacesPassive" htmlFor="compareFacesEndpoint">
            <Input id="compareFacesEndpoint" {...register("compareFacesEndpoint")} />
          </Field>
          <Field label="Endpoint getValidationKeys" htmlFor="getValidationKeysEndpoint">
            <Input id="getValidationKeysEndpoint" {...register("getValidationKeysEndpoint")} />
          </Field>
          <Field label="Endpoint saveValidationData" htmlFor="saveValidationDataEndpoint">
            <Input id="saveValidationDataEndpoint" {...register("saveValidationDataEndpoint")} />
          </Field>
          <Field label="Intentos máximos de NAAT-CHECK" htmlFor="checkMaxAttempts">
            <Input id="checkMaxAttempts" type="number" {...register("checkMaxAttempts", { valueAsNumber: true })} />
          </Field>
          <Field label="Riesgo aceptado" htmlFor="checkAcceptedRisk">
            <Select id="checkAcceptedRisk" {...register("checkAcceptedRisk")}>
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
            </Select>
          </Field>
          <Field label="Confianza mínima del match facial (%)" htmlFor="faceMatchMinConfidence">
            <Input id="faceMatchMinConfidence" type="number" {...register("faceMatchMinConfidence", { valueAsNumber: true })} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mensajes del onboarding</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <p className="text-xs text-muted-foreground md:col-span-2">
            Texto que ve el cliente final en cada paso de la captura (<code>/executions/new-websdk</code>). No hace falta
            tocarlos: cada campo trae un mensaje neutro por defecto.
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

      <div className="flex justify-end">
        <Button type="submit" disabled={formState.isSubmitting}>
          Guardar configuración Web SDK
        </Button>
      </div>
    </form>
    </div>
  );
}

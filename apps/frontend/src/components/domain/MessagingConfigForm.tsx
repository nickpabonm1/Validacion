import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MessagingConfigInputSchema, type MessagingConfigInput } from "@fad-console/validation-schemas";
import type { MessagingConfigDto } from "@fad-console/shared-types";
import { useMessagingConfig, useUpdateMessagingConfig } from "../../features/settings/useMessagingConfig";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Field, InlineSwitchField } from "../../builder/editors/Field";
import { CredentialInput } from "./CredentialInput";
import { Skeleton } from "../ui/misc";
import { useToast } from "../ui/toast";

const BLANK: MessagingConfigInput = {
  smtpHost: undefined,
  smtpPort: 587,
  smtpSecure: false,
  fromAddress: undefined,
  fromName: "FAD Biometrics Console",
  whatsappApiBaseUrl: "https://graph.facebook.com/v20.0",
  whatsappPhoneNumberId: undefined,
  whatsappTemplateName: undefined,
  whatsappTemplateLanguage: "es",
};

function toFormValues(config: MessagingConfigDto): MessagingConfigInput {
  return {
    smtpHost: config.smtpHost ?? undefined,
    smtpPort: config.smtpPort,
    smtpSecure: config.smtpSecure,
    fromAddress: config.fromAddress ?? undefined,
    fromName: config.fromName,
    whatsappApiBaseUrl: config.whatsappApiBaseUrl,
    whatsappPhoneNumberId: config.whatsappPhoneNumberId ?? undefined,
    whatsappTemplateName: config.whatsappTemplateName ?? undefined,
    whatsappTemplateLanguage: config.whatsappTemplateLanguage,
  };
}

/** Configuración global (no por ambiente) de mensajería saliente para enviar el enlace de
 * captura Web SDK compartido — ver docs/websdk-integration.md "Envío de procesos". */
export function MessagingConfigForm() {
  const { data: config, isLoading } = useMessagingConfig();
  const updateConfig = useUpdateMessagingConfig();
  const { notify } = useToast();

  const { register, handleSubmit, reset, setValue, watch, formState } = useForm<MessagingConfigInput>({
    resolver: zodResolver(MessagingConfigInputSchema),
    defaultValues: BLANK,
  });

  useEffect(() => {
    reset(config ? toFormValues(config) : BLANK);
  }, [config, reset]);

  const values = watch();

  if (isLoading) return <Skeleton className="h-96" />;

  async function onSubmit(formValues: MessagingConfigInput) {
    try {
      await updateConfig.mutateAsync(formValues);
      notify({ title: "Configuración de mensajería guardada", tone: "success" });
    } catch (error) {
      notify({ title: "Error al guardar", description: (error as Error).message, tone: "error" });
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Correo (SMTP)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Servidor SMTP" htmlFor="smtpHost" hint="ej. smtp.sendgrid.net">
            <Input id="smtpHost" {...register("smtpHost")} />
          </Field>
          <Field label="Puerto" htmlFor="smtpPort">
            <Input id="smtpPort" type="number" {...register("smtpPort", { valueAsNumber: true })} />
          </Field>
          <InlineSwitchField label="Conexión TLS (secure)" checked={values.smtpSecure} onChange={(v) => setValue("smtpSecure", v)} />
          <div />
          <CredentialInput
            id="smtpUser"
            label="Usuario SMTP"
            configured={config?.smtpUserConfigured ?? false}
            value={values.smtpUser ?? ""}
            onChange={(v) => setValue("smtpUser", v)}
          />
          <CredentialInput
            id="smtpPassword"
            label="Contraseña SMTP"
            configured={config?.smtpPasswordConfigured ?? false}
            value={values.smtpPassword ?? ""}
            onChange={(v) => setValue("smtpPassword", v)}
          />
          <Field label="Correo remitente" htmlFor="fromAddress">
            <Input id="fromAddress" type="email" {...register("fromAddress")} />
          </Field>
          <Field label="Nombre remitente" htmlFor="fromName">
            <Input id="fromName" {...register("fromName")} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>WhatsApp (Cloud API de Meta)</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <p className="text-xs text-muted-foreground md:col-span-2">
            Requiere una cuenta de WhatsApp Business y una plantilla ya aprobada por Meta: fuera de una conversación
            abierta, WhatsApp solo permite enviar mensajes de plantilla. El botón de WhatsApp del enlace compartido
            (abrir wa.me) funciona sin esto — esta sección es para el envío automático desde el servidor.
          </p>
          <Field label="URL base de la API" htmlFor="whatsappApiBaseUrl">
            <Input id="whatsappApiBaseUrl" {...register("whatsappApiBaseUrl")} />
          </Field>
          <Field label="Phone Number ID" htmlFor="whatsappPhoneNumberId">
            <Input id="whatsappPhoneNumberId" {...register("whatsappPhoneNumberId")} />
          </Field>
          <CredentialInput
            id="whatsappAccessToken"
            label="Token de acceso"
            configured={config?.whatsappAccessTokenConfigured ?? false}
            value={values.whatsappAccessToken ?? ""}
            onChange={(v) => setValue("whatsappAccessToken", v)}
          />
          <div />
          <Field label="Nombre de la plantilla" htmlFor="whatsappTemplateName" hint="Debe estar aprobada por Meta">
            <Input id="whatsappTemplateName" {...register("whatsappTemplateName")} />
          </Field>
          <Field label="Idioma de la plantilla" htmlFor="whatsappTemplateLanguage">
            <Input id="whatsappTemplateLanguage" {...register("whatsappTemplateLanguage")} />
          </Field>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={formState.isSubmitting}>
          Guardar mensajería
        </Button>
      </div>
    </form>
  );
}

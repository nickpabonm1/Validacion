import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { BootstrapAdminInputSchema, ApiEnvironmentInputSchema } from "@fad-console/validation-schemas";
import type { ApiEnvironmentDto, TestConnectionResultDto } from "@fad-console/shared-types";
import { CheckCircle2, ShieldHalf, XCircle } from "lucide-react";
import { api, ApiError } from "../lib/api-client";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";

const STEPS = ["Administrador", "Conexión", "Prueba", "Plantilla"] as const;

const AdminFormSchema = BootstrapAdminInputSchema.extend({ confirmPassword: z.string() }).refine(
  (data) => data.password === data.confirmPassword,
  { message: "Las contraseñas no coinciden", path: ["confirmPassword"] },
);
type AdminForm = z.infer<typeof AdminFormSchema>;

const EnvironmentFormSchema = ApiEnvironmentInputSchema.pick({
  name: true,
  baseUrl: true,
  environmentType: true,
  basicAuthUsername: true,
  basicAuthPassword: true,
  apiUsername: true,
  apiPassword: true,
});
type EnvironmentForm = z.infer<typeof EnvironmentFormSchema>;

const BASIC_TEMPLATE_CONFIG = {
  processName: "Validación básica Colombia",
  validity: 5,
  client: { name: "Nombre del cliente", mail: "cliente@ejemplo.com", phone: "+573000000000" },
  steps: {
    location: { order: 1, show: true, configuration: {}, features: {} },
    privacyNotice: { order: 2, show: true, configuration: {}, features: {} },
    formValidationId: { order: 3, show: true, configuration: {}, features: {}, input: { forms: [] } },
  },
  customization: { theme: [], header: [] },
  feature: {},
  notifications: { email: false, whatsapp: false },
};

export function SetupWizardPage() {
  const [step, setStep] = useState(0);
  const [environment, setEnvironment] = useState<ApiEnvironmentDto | null>(null);
  const [testResult, setTestResult] = useState<TestConnectionResultDto | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const adminForm = useForm<AdminForm>({ resolver: zodResolver(AdminFormSchema) });
  const bootstrapMutation = useMutation({
    mutationFn: (values: AdminForm) => api.post("/auth/bootstrap/admin", values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["auth"] });
      setStep(1);
    },
  });

  const envForm = useForm<EnvironmentForm>({ resolver: zodResolver(EnvironmentFormSchema) });
  const createEnvMutation = useMutation({
    mutationFn: (values: EnvironmentForm) => api.post<{ environment: ApiEnvironmentDto }>("/environments", values),
    onSuccess: (res) => {
      setEnvironment(res.environment);
      setStep(2);
    },
  });

  const testMutation = useMutation({
    mutationFn: (id: string) => api.post<TestConnectionResultDto>(`/environments/${id}/test-connection`),
    onSuccess: (res) => setTestResult(res),
  });

  const templateMutation = useMutation({
    mutationFn: (name: string) =>
      api.post("/templates", {
        name,
        description: "Plantilla creada por el asistente de instalación.",
        environmentId: environment?.id ?? null,
        requestConfig: BASIC_TEMPLATE_CONFIG,
        active: true,
      }),
    onSuccess: () => navigate("/", { replace: true }),
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-xl">
        <CardHeader className="items-center text-center">
          <ShieldHalf className="mb-2 h-8 w-8 text-primary" />
          <CardTitle>Configuración inicial</CardTitle>
          <CardDescription>
            Paso {step + 1} de {STEPS.length}: {STEPS[step]}
          </CardDescription>
          <ol className="mt-4 flex gap-2" aria-label="Progreso de instalación">
            {STEPS.map((label, index) => (
              <li
                key={label}
                className={`h-1.5 w-12 rounded-full ${index <= step ? "bg-primary" : "bg-muted"}`}
                aria-current={index === step ? "step" : undefined}
              />
            ))}
          </ol>
        </CardHeader>
        <CardContent>
          {step === 0 ? (
            <form
              className="space-y-4"
              noValidate
              onSubmit={adminForm.handleSubmit((values) => bootstrapMutation.mutate(values))}
            >
              <p className="text-sm text-muted-foreground">Crea la cuenta administradora de la consola.</p>
              <div className="space-y-1.5">
                <Label htmlFor="name">Nombre</Label>
                <Input id="name" {...adminForm.register("name")} />
                {adminForm.formState.errors.name ? (
                  <p className="text-xs text-destructive">{adminForm.formState.errors.name.message}</p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Correo</Label>
                <Input id="email" type="email" {...adminForm.register("email")} />
                {adminForm.formState.errors.email ? (
                  <p className="text-xs text-destructive">{adminForm.formState.errors.email.message}</p>
                ) : null}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="password">Contraseña</Label>
                  <Input id="password" type="password" {...adminForm.register("password")} />
                  {adminForm.formState.errors.password ? (
                    <p className="text-xs text-destructive">{adminForm.formState.errors.password.message}</p>
                  ) : null}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword">Confirmar</Label>
                  <Input id="confirmPassword" type="password" {...adminForm.register("confirmPassword")} />
                  {adminForm.formState.errors.confirmPassword ? (
                    <p className="text-xs text-destructive">{adminForm.formState.errors.confirmPassword.message}</p>
                  ) : null}
                </div>
              </div>
              {bootstrapMutation.error instanceof ApiError ? (
                <p className="text-sm text-destructive">{bootstrapMutation.error.message}</p>
              ) : null}
              <Button type="submit" className="w-full" disabled={bootstrapMutation.isPending}>
                {bootstrapMutation.isPending ? "Creando…" : "Crear administrador y continuar"}
              </Button>
            </form>
          ) : null}

          {step === 1 ? (
            <form
              className="space-y-4"
              noValidate
              onSubmit={envForm.handleSubmit((values) => createEnvMutation.mutate(values))}
            >
              <p className="text-sm text-muted-foreground">
                Configura una conexión con FAD (opcional — puedes omitir este paso y configurarla luego en
                Configuración &gt; Conexiones API).
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="env-name">Nombre del ambiente</Label>
                <Input id="env-name" placeholder="UATHA" {...envForm.register("name")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="env-baseurl">URL base</Label>
                <Input id="env-baseurl" placeholder="https://uatha.firmaautografa.com" {...envForm.register("baseUrl")} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="basic-user">Usuario Basic Auth</Label>
                  <Input id="basic-user" {...envForm.register("basicAuthUsername")} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="basic-pass">Contraseña Basic Auth</Label>
                  <Input id="basic-pass" type="password" {...envForm.register("basicAuthPassword")} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="api-user">Usuario API</Label>
                  <Input id="api-user" {...envForm.register("apiUsername")} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="api-pass">Contraseña API</Label>
                  <Input id="api-pass" type="password" {...envForm.register("apiPassword")} />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setStep(3)}>
                  Omitir por ahora
                </Button>
                <Button type="submit" className="flex-1" disabled={createEnvMutation.isPending}>
                  {createEnvMutation.isPending ? "Guardando…" : "Guardar y continuar"}
                </Button>
              </div>
            </form>
          ) : null}

          {step === 2 ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                Prueba la autenticación contra FAD con las credenciales que acabas de guardar.
              </p>
              <Button
                onClick={() => environment && testMutation.mutate(environment.id)}
                disabled={testMutation.isPending}
              >
                {testMutation.isPending ? "Probando…" : "Probar conexión"}
              </Button>
              {testResult ? (
                <div
                  className={`flex items-center justify-center gap-2 rounded-md p-3 text-sm ${
                    testResult.success ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
                  }`}
                >
                  {testResult.success ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                  {testResult.message}
                </div>
              ) : null}
              <Button variant="secondary" className="w-full" onClick={() => setStep(3)}>
                Continuar
              </Button>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Elige una plantilla básica para comenzar (podrás editarla luego en el Constructor).</p>
              <div className="grid gap-3">
                <Button
                  variant="outline"
                  className="h-auto flex-col items-start p-4 text-left"
                  onClick={() => templateMutation.mutate("Colombia — Básica")}
                  disabled={templateMutation.isPending}
                >
                  <span className="font-medium">Colombia — Básica</span>
                  <span className="text-xs text-muted-foreground">Ubicación, aviso de privacidad y formulario</span>
                </Button>
              </div>
              <Button variant="ghost" className="w-full" onClick={() => navigate("/", { replace: true })}>
                Omitir y terminar
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

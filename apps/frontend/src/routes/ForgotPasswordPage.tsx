import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ForgotPasswordInputSchema, type ForgotPasswordInput } from "@fad-console/validation-schemas";
import { ShieldHalf } from "lucide-react";
import { useForgotPassword } from "../features/auth/usePasswordReset";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";

export function ForgotPasswordPage() {
  const forgotPassword = useForgotPassword();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(ForgotPasswordInputSchema) });

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <ShieldHalf className="mb-2 h-8 w-8 text-primary" />
          <CardTitle>Olvidé mi contraseña</CardTitle>
          <CardDescription>Te enviaremos un enlace para restablecerla, válido por 30 minutos.</CardDescription>
        </CardHeader>
        <CardContent>
          {forgotPassword.isSuccess ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">
                Si el correo existe en el sistema, te enviamos un enlace para restablecer tu contraseña. Revisa tu bandeja de
                entrada (y spam).
              </p>
              <Link to="/login" className="text-sm text-primary hover:underline">
                Volver a iniciar sesión
              </Link>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit((values) => forgotPassword.mutate(values))} noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="email">Correo electrónico</Label>
                <Input id="email" type="email" autoComplete="username" autoFocus {...register("email")} />
                {errors.email ? <p className="text-xs text-destructive">{errors.email.message}</p> : null}
              </div>
              <Button type="submit" className="w-full" disabled={forgotPassword.isPending}>
                {forgotPassword.isPending ? "Enviando…" : "Enviar enlace"}
              </Button>
              <div className="text-center">
                <Link to="/login" className="text-sm text-muted-foreground hover:underline">
                  Volver a iniciar sesión
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

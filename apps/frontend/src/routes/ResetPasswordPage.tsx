import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ResetPasswordInputSchema, type ResetPasswordInput } from "@fad-console/validation-schemas";
import { ShieldHalf } from "lucide-react";
import { useResetPassword } from "../features/auth/usePasswordReset";
import { ApiError } from "../lib/api-client";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../components/ui/card";

export function ResetPasswordPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const resetPassword = useResetPassword();
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mismatchError, setMismatchError] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(ResetPasswordInputSchema),
    defaultValues: { token: token ?? "" },
  });

  if (!token) return <Navigate to="/forgot-password" replace />;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <ShieldHalf className="mb-2 h-8 w-8 text-primary" />
          <CardTitle>Restablecer contraseña</CardTitle>
          <CardDescription>Elige tu nueva contraseña.</CardDescription>
        </CardHeader>
        <CardContent>
          {resetPassword.isSuccess ? (
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted-foreground">Tu contraseña se actualizó correctamente.</p>
              <Button className="w-full" onClick={() => navigate("/login")}>
                Ir a iniciar sesión
              </Button>
            </div>
          ) : (
            <form
              className="space-y-4"
              onSubmit={handleSubmit((values) => {
                if (values.password !== confirmPassword) {
                  setMismatchError(true);
                  return;
                }
                setMismatchError(false);
                resetPassword.mutate(values);
              })}
              noValidate
            >
              <div className="space-y-1.5">
                <Label htmlFor="password">Nueva contraseña</Label>
                <Input id="password" type="password" autoComplete="new-password" autoFocus {...register("password")} />
                {errors.password ? <p className="text-xs text-destructive">{errors.password.message}</p> : null}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                {mismatchError ? <p className="text-xs text-destructive">Las contraseñas no coinciden.</p> : null}
              </div>
              {resetPassword.error instanceof ApiError ? (
                <p className="text-sm text-destructive">{resetPassword.error.message}</p>
              ) : null}
              <Button type="submit" className="w-full" disabled={resetPassword.isPending || !watch("password")}>
                {resetPassword.isPending ? "Guardando…" : "Restablecer contraseña"}
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

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, Plus, Trash2 } from "lucide-react";
import { CreateUserInputSchema, type CreateUserInput } from "@fad-console/validation-schemas";
import type { UserRole } from "@fad-console/shared-types";
import { useAuth } from "../lib/auth-context";
import { useUsersAdmin, useCreateUserAdmin, useUpdateUserAdmin, useDeleteUserAdmin } from "../features/users/useUsersAdmin";
import { useClients } from "../features/clients/useClients";
import { PageHeader, Skeleton } from "../components/ui/misc";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select } from "../components/ui/select";
import { Field } from "../builder/editors/Field";
import { Badge } from "../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "../components/ui/dialog";
import { useToast } from "../components/ui/toast";

export function UsersPage() {
  const { user: currentUser } = useAuth();
  const { data: users, isLoading } = useUsersAdmin();
  const createUser = useCreateUserAdmin();
  const updateUser = useUpdateUserAdmin();
  const deleteUser = useDeleteUserAdmin();
  const { notify } = useToast();
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const { data: clients } = useClients();
  const clientNameById = new Map((clients ?? []).map((c) => [c.id, c.name]));

  const [resetPasswordUser, setResetPasswordUser] = useState<{ id: string; name: string } | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetPasswordError, setResetPasswordError] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState } = useForm<CreateUserInput>({
    resolver: zodResolver(CreateUserInputSchema),
    defaultValues: { name: "", email: "", password: "", role: "OPERATOR", active: true },
  });

  return (
    <div>
      <PageHeader
        title="Usuarios"
        description="Administradores, operadores y auditores de la consola."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button
                onClick={() => {
                  reset({ name: "", email: "", password: "", role: "OPERATOR", active: true });
                  setClientId("");
                }}
              >
                <Plus className="h-4 w-4" /> Nuevo usuario
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nuevo usuario</DialogTitle>
              </DialogHeader>
              <form
                className="space-y-3"
                onSubmit={handleSubmit(async (values) => {
                  try {
                    await createUser.mutateAsync({ ...values, clientId: clientId || undefined });
                    notify({ title: "Usuario creado", tone: "success" });
                    setOpen(false);
                  } catch (error) {
                    notify({ title: "Error al crear usuario", description: (error as Error).message, tone: "error" });
                  }
                })}
              >
                <Field label="Nombre" htmlFor="name">
                  <Input id="name" {...register("name")} />
                </Field>
                <Field label="Correo" htmlFor="email">
                  <Input id="email" type="email" {...register("email")} />
                </Field>
                {clients && clients.length > 0 ? (
                  <Field label="Cliente" htmlFor="clientId" hint="Vacío = tu propio cliente (o de plataforma, sin restricción, si eres administrador global).">
                    <Select id="clientId" value={clientId} onChange={(e) => setClientId(e.target.value)}>
                      <option value="">— Sin especificar —</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                ) : null}
                <Field label="Contraseña" htmlFor="password" hint="Mínimo 10 caracteres.">
                  <Input id="password" type="password" {...register("password")} />
                </Field>
                <Field label="Rol" htmlFor="role">
                  <Select id="role" {...register("role")}>
                    <option value="ADMIN">ADMIN</option>
                    <option value="OPERATOR">OPERATOR</option>
                    <option value="AUDITOR">AUDITOR</option>
                    <option value="LAUNCHER">LAUNCHER (solo enviar procesos)</option>
                  </Select>
                </Field>
                {formState.errors.root ? <p className="text-xs text-destructive">{formState.errors.root.message}</p> : null}
                <DialogFooter>
                  <Button type="submit" disabled={formState.isSubmitting}>
                    Crear
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {isLoading ? (
        <Skeleton className="h-40" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Nombre</th>
                <th className="px-4 py-2.5 font-medium">Correo</th>
                <th className="px-4 py-2.5 font-medium">Cliente</th>
                <th className="px-4 py-2.5 font-medium">Rol</th>
                <th className="px-4 py-2.5 font-medium">Estado</th>
                <th className="px-4 py-2.5 font-medium" />
              </tr>
            </thead>
            <tbody>
              {users?.map((u) => (
                <tr key={u.id} className="border-t border-border">
                  <td className="px-4 py-2.5">{u.name}</td>
                  <td className="px-4 py-2.5">{u.email}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {u.clientId ? (clientNameById.get(u.clientId) ?? "Cliente eliminado") : "— Plataforma —"}
                  </td>
                  <td className="px-4 py-2.5">
                    <Select
                      value={u.role}
                      disabled={u.id === currentUser?.id}
                      onChange={async (e) => {
                        await updateUser.mutateAsync({ id: u.id, input: { role: e.target.value as UserRole } });
                        notify({ title: "Rol actualizado", tone: "success" });
                      }}
                      className="h-8 w-32 text-xs"
                    >
                      <option value="ADMIN">ADMIN</option>
                      <option value="OPERATOR">OPERATOR</option>
                      <option value="AUDITOR">AUDITOR</option>
                    </Select>
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      type="button"
                      disabled={u.id === currentUser?.id}
                      onClick={async () => {
                        await updateUser.mutateAsync({ id: u.id, input: { active: !u.active } });
                      }}
                    >
                      <Badge tone={u.active ? "success" : "neutral"}>{u.active ? "Activo" : "Inactivo"}</Badge>
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Restablecer contraseña"
                      onClick={() => {
                        setNewPassword("");
                        setResetPasswordError(null);
                        setResetPasswordUser({ id: u.id, name: u.name });
                      }}
                    >
                      <KeyRound className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={u.id === currentUser?.id}
                      onClick={async () => {
                        if (!window.confirm(`¿Eliminar a "${u.name}"?`)) return;
                        try {
                          await deleteUser.mutateAsync(u.id);
                          notify({ title: "Usuario eliminado", tone: "success" });
                        } catch (error) {
                          notify({ title: "No se pudo eliminar", description: (error as Error).message, tone: "error" });
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={resetPasswordUser !== null} onOpenChange={(next) => !next && setResetPasswordUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restablecer contraseña — {resetPasswordUser?.name}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!resetPasswordUser) return;
              if (newPassword.length < 10) {
                setResetPasswordError("Mínimo 10 caracteres.");
                return;
              }
              try {
                await updateUser.mutateAsync({ id: resetPasswordUser.id, input: { password: newPassword } });
                notify({ title: "Contraseña actualizada", tone: "success" });
                setResetPasswordUser(null);
              } catch (error) {
                setResetPasswordError((error as Error).message);
              }
            }}
          >
            <p className="text-xs text-muted-foreground">
              Las contraseñas se guardan cifradas (hash) y no pueden mostrarse — solo puedes establecer una nueva.
            </p>
            <Field label="Nueva contraseña" htmlFor="newPassword" hint="Mínimo 10 caracteres.">
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setResetPasswordError(null);
                }}
                autoFocus
              />
            </Field>
            {resetPasswordError ? <p className="text-xs text-destructive">{resetPasswordError}</p> : null}
            <DialogFooter>
              <Button type="submit" disabled={updateUser.isPending}>
                Guardar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

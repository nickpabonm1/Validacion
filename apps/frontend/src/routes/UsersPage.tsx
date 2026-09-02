import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { CreateUserInputSchema, type CreateUserInput } from "@fad-console/validation-schemas";
import type { UserRole } from "@fad-console/shared-types";
import { useAuth } from "../lib/auth-context";
import { useUsersAdmin, useCreateUserAdmin, useUpdateUserAdmin, useDeleteUserAdmin } from "../features/users/useUsersAdmin";
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
                onClick={() => reset({ name: "", email: "", password: "", role: "OPERATOR", active: true })}
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
                    await createUser.mutateAsync(values);
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
    </div>
  );
}

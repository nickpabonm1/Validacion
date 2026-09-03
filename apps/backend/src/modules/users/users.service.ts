import type { AuthenticatedUserDto, UserRole } from "@fad-console/shared-types";
import { prisma } from "../../lib/prisma";
import { hashPassword } from "../auth/password";
import { AppError } from "../../lib/errors";
import { assertWithinScope, clientWhereClause, type ClientScope } from "../clients/client-scope";

export function toUserDto(user: {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  clientId?: string | null;
}): AuthenticatedUserDto {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as UserRole,
    active: user.active,
    clientId: user.clientId ?? null,
  };
}

export async function countUsers(): Promise<number> {
  return prisma.user.count();
}

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email: email.toLowerCase() } });
}

export async function createUser(
  input: { name: string; email: string; password: string; role: UserRole; active?: boolean; clientId?: string | null },
  scope?: ClientScope,
) {
  const existing = await findUserByEmail(input.email);
  if (existing) {
    throw AppError.conflict("Ya existe un usuario con ese correo");
  }
  let clientId = input.clientId ?? null;
  if (scope) {
    // Un ADMIN de cliente solo puede crear usuarios dentro de su propio subárbol; sin cliente
    // explícito, se asume su propio cliente. Nunca puede crear un usuario de plataforma
    // (clientId: null) — assertWithinScope lo rechaza porque null no está en su alcance.
    if (scope.allowedIds !== null) {
      if (!clientId) clientId = scope.clientId;
      assertWithinScope(clientId, scope);
    }
  }
  const passwordHash = await hashPassword(input.password);
  return prisma.user.create({
    data: {
      name: input.name,
      email: input.email.toLowerCase(),
      passwordHash,
      role: input.role,
      active: input.active ?? true,
      clientId,
    },
  });
}

export async function listUsers(scope?: ClientScope) {
  const where = scope ? clientWhereClause(scope) : undefined;
  return prisma.user.findMany({ where: where ? { clientId: where } : {}, orderBy: { createdAt: "asc" } });
}

export async function updateUser(
  id: string,
  input: { name?: string; role?: UserRole; active?: boolean; password?: string },
  scope?: ClientScope,
) {
  const data: Record<string, unknown> = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.role !== undefined) data.role = input.role;
  if (input.active !== undefined) data.active = input.active;
  if (input.password) data.passwordHash = await hashPassword(input.password);

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw AppError.notFound("Usuario no encontrado");
  if (scope) assertWithinScope(user.clientId, scope);

  if (input.role && input.role !== "ADMIN" && user.role === "ADMIN") {
    const admins = await prisma.user.count({ where: { role: "ADMIN", active: true } });
    if (admins <= 1) {
      throw AppError.conflict("No se puede quitar el rol ADMIN al último administrador activo");
    }
  }
  if (input.active === false && user.role === "ADMIN") {
    const admins = await prisma.user.count({ where: { role: "ADMIN", active: true } });
    if (admins <= 1) {
      throw AppError.conflict("No se puede desactivar al último administrador activo");
    }
  }

  return prisma.user.update({ where: { id }, data });
}

export async function deleteUser(id: string, scope?: ClientScope) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw AppError.notFound("Usuario no encontrado");
  if (scope) assertWithinScope(user.clientId, scope);
  if (user.role === "ADMIN") {
    const admins = await prisma.user.count({ where: { role: "ADMIN" } });
    if (admins <= 1) {
      throw AppError.conflict("No se puede eliminar al último administrador");
    }
  }
  await prisma.user.delete({ where: { id } });
}

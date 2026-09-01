import type { AuthenticatedUserDto, UserRole } from "@fad-console/shared-types";
import { prisma } from "../../lib/prisma";
import { hashPassword } from "../auth/password";
import { AppError } from "../../lib/errors";

export function toUserDto(user: { id: string; name: string; email: string; role: string; active: boolean }): AuthenticatedUserDto {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as UserRole,
    active: user.active,
  };
}

export async function countUsers(): Promise<number> {
  return prisma.user.count();
}

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email: email.toLowerCase() } });
}

export async function createUser(input: { name: string; email: string; password: string; role: UserRole; active?: boolean }) {
  const existing = await findUserByEmail(input.email);
  if (existing) {
    throw AppError.conflict("Ya existe un usuario con ese correo");
  }
  const passwordHash = await hashPassword(input.password);
  return prisma.user.create({
    data: {
      name: input.name,
      email: input.email.toLowerCase(),
      passwordHash,
      role: input.role,
      active: input.active ?? true,
    },
  });
}

export async function listUsers() {
  return prisma.user.findMany({ orderBy: { createdAt: "asc" } });
}

export async function updateUser(
  id: string,
  input: { name?: string; role?: UserRole; active?: boolean; password?: string },
) {
  const data: Record<string, unknown> = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.role !== undefined) data.role = input.role;
  if (input.active !== undefined) data.active = input.active;
  if (input.password) data.passwordHash = await hashPassword(input.password);

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw AppError.notFound("Usuario no encontrado");

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

export async function deleteUser(id: string) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw AppError.notFound("Usuario no encontrado");
  if (user.role === "ADMIN") {
    const admins = await prisma.user.count({ where: { role: "ADMIN" } });
    if (admins <= 1) {
      throw AppError.conflict("No se puede eliminar al último administrador");
    }
  }
  await prisma.user.delete({ where: { id } });
}

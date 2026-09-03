import type { ClientBrandingDto, ClientDto } from "@fad-console/shared-types";
import type { CreateClientInput, UpdateClientBrandingInput, UpdateClientInput } from "@fad-console/validation-schemas";
import { prisma } from "../../lib/prisma";
import { AppError } from "../../lib/errors";
import { assertWithinScope, clientWhereClause, type ClientScope } from "./client-scope";

const WITH_COUNTS = {
  include: { _count: { select: { users: true, children: true, environments: true } } },
} as const;

interface ClientRecordShape {
  id: string;
  name: string;
  parentClientId: string | null;
  logoDataUrl: string | null;
  faviconDataUrl: string | null;
  primaryColor: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count: { users: number; children: number; environments: number };
}

export function toClientDto(client: ClientRecordShape): ClientDto {
  return {
    id: client.id,
    name: client.name,
    parentClientId: client.parentClientId,
    logoDataUrl: client.logoDataUrl,
    faviconDataUrl: client.faviconDataUrl,
    primaryColor: client.primaryColor,
    active: client.active,
    userCount: client._count.users,
    childCount: client._count.children,
    environmentCount: client._count.environments,
    createdAt: client.createdAt.toISOString(),
    updatedAt: client.updatedAt.toISOString(),
  };
}

export async function listClients(scope: ClientScope): Promise<ClientDto[]> {
  const where = clientWhereClause(scope);
  const clients = await prisma.client.findMany({
    where: where ? { id: where } : {},
    orderBy: { createdAt: "asc" },
    ...WITH_COUNTS,
  });
  return clients.map(toClientDto);
}

export async function createClient(input: CreateClientInput, scope: ClientScope): Promise<ClientDto> {
  let parentClientId = input.parentClientId ?? null;
  if (scope.allowedIds !== null) {
    // Un usuario de cliente solo puede crear hijos dentro de su propio subárbol; sin padre
    // explícito, se asume su propio cliente (crear un "hijo" directo).
    if (!parentClientId) parentClientId = scope.clientId;
    assertWithinScope(parentClientId, scope);
  }
  if (parentClientId) {
    const parent = await prisma.client.findUnique({ where: { id: parentClientId } });
    if (!parent) throw AppError.notFound("El cliente padre no existe");
  }
  const client = await prisma.client.create({
    data: { name: input.name, parentClientId },
    ...WITH_COUNTS,
  });
  return toClientDto(client);
}

export async function updateClient(id: string, input: UpdateClientInput, scope: ClientScope): Promise<ClientDto> {
  assertWithinScope(id, scope);
  const data: Record<string, unknown> = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.active !== undefined) data.active = input.active;
  const client = await prisma.client.update({ where: { id }, data, ...WITH_COUNTS });
  return toClientDto(client);
}

export async function updateClientBranding(
  id: string,
  input: UpdateClientBrandingInput,
  scope: ClientScope,
): Promise<ClientDto> {
  assertWithinScope(id, scope);
  const data: Record<string, unknown> = {};
  if (input.logoDataUrl !== undefined) data.logoDataUrl = input.logoDataUrl === "" ? null : input.logoDataUrl;
  if (input.faviconDataUrl !== undefined) data.faviconDataUrl = input.faviconDataUrl === "" ? null : input.faviconDataUrl;
  if (input.primaryColor !== undefined) data.primaryColor = input.primaryColor === "" ? null : input.primaryColor;
  const client = await prisma.client.update({ where: { id }, data, ...WITH_COUNTS });
  return toClientDto(client);
}

export async function deleteClient(id: string, scope: ClientScope): Promise<void> {
  assertWithinScope(id, scope);
  const client = await prisma.client.findUnique({ where: { id }, ...WITH_COUNTS });
  if (!client) throw AppError.notFound("Cliente no encontrado");
  if (client._count.users > 0 || client._count.children > 0 || client._count.environments > 0) {
    throw AppError.conflict("No se puede eliminar un cliente con usuarios, ambientes o hijos asociados");
  }
  await prisma.client.delete({ where: { id } });
}

/** Marca (logo/color/favicon) a aplicar para la sesión de un usuario. Si el cliente propio no
 * tiene marca configurada, se hereda la del ancestro más cercano que sí la tenga — así un hijo
 * recién creado no queda sin logo hasta que alguien lo configure explícitamente. */
export async function getClientBranding(clientId: string | null): Promise<ClientBrandingDto> {
  const empty: ClientBrandingDto = { clientId: null, clientName: null, logoDataUrl: null, faviconDataUrl: null, primaryColor: null };
  if (!clientId) return empty;

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) return empty;

  let current: typeof client | null = client;
  while (current && !current.logoDataUrl && !current.primaryColor && !current.faviconDataUrl && current.parentClientId) {
    current = await prisma.client.findUnique({ where: { id: current.parentClientId } });
  }

  return {
    clientId: client.id,
    clientName: client.name,
    logoDataUrl: current?.logoDataUrl ?? null,
    faviconDataUrl: current?.faviconDataUrl ?? null,
    primaryColor: current?.primaryColor ?? null,
  };
}

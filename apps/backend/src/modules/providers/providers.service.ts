import type { ProviderCatalogEntryDto } from "@fad-console/shared-types";
import type { ProviderCatalogEntryInput } from "@fad-console/validation-schemas";
import { prisma } from "../../lib/prisma";
import { fromJsonField, toJsonField } from "../../lib/json-field";
import { AppError } from "../../lib/errors";

type ProviderRecord = Awaited<ReturnType<typeof prisma.providerCatalogEntry.findFirstOrThrow>>;

export function toProviderDto(entry: ProviderRecord): ProviderCatalogEntryDto {
  return {
    id: entry.id,
    providerKey: entry.providerKey,
    providerLabel: entry.providerLabel,
    providerType: entry.providerType,
    externalProviderId: entry.externalProviderId,
    enabled: entry.enabled,
    metadata: fromJsonField(entry.metadata, {}),
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
  };
}

export async function listProviders() {
  return prisma.providerCatalogEntry.findMany({ orderBy: { providerLabel: "asc" } });
}

export async function createProvider(input: ProviderCatalogEntryInput) {
  const existing = await prisma.providerCatalogEntry.findUnique({ where: { providerKey: input.providerKey } });
  if (existing) throw AppError.conflict("Ya existe un proveedor con esa clave");
  return prisma.providerCatalogEntry.create({
    data: {
      providerKey: input.providerKey,
      providerLabel: input.providerLabel,
      providerType: input.providerType,
      externalProviderId: input.externalProviderId,
      enabled: input.enabled,
      metadata: toJsonField(input.metadata),
    },
  });
}

export async function updateProvider(id: string, input: ProviderCatalogEntryInput) {
  const existing = await prisma.providerCatalogEntry.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound("Proveedor no encontrado");
  return prisma.providerCatalogEntry.update({
    where: { id },
    data: {
      providerKey: input.providerKey,
      providerLabel: input.providerLabel,
      providerType: input.providerType,
      externalProviderId: input.externalProviderId,
      enabled: input.enabled,
      metadata: toJsonField(input.metadata),
    },
  });
}

export async function deleteProvider(id: string) {
  const existing = await prisma.providerCatalogEntry.findUnique({ where: { id } });
  if (!existing) throw AppError.notFound("Proveedor no encontrado");
  await prisma.providerCatalogEntry.delete({ where: { id } });
}

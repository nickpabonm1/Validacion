import { prisma } from "../../lib/prisma";
import { fromJsonField, toJsonField } from "../../lib/json-field";
import { AppError } from "../../lib/errors";
import type { ResponseViewInput } from "@fad-console/validation-schemas";
import type { ResponseViewConfigShape } from "./projection";

type ResponseViewRecord = Awaited<ReturnType<typeof prisma.responseView.findFirstOrThrow>>;

export function toResponseViewDto(view: ResponseViewRecord) {
  return {
    id: view.id,
    name: view.name,
    description: view.description,
    kind: view.kind,
    templateId: view.templateId,
    isDefault: view.isDefault,
    configuration: fromJsonField<ResponseViewConfigShape>(view.configuration, { fields: [] }),
    createdAt: view.createdAt.toISOString(),
    updatedAt: view.updatedAt.toISOString(),
  };
}

export async function listResponseViews() {
  return prisma.responseView.findMany({ orderBy: { createdAt: "asc" } });
}

export async function getResponseViewOrThrow(id: string) {
  const view = await prisma.responseView.findUnique({ where: { id } });
  if (!view) throw AppError.notFound("Vista de respuesta no encontrada");
  return view;
}

export async function createResponseView(input: ResponseViewInput) {
  return prisma.responseView.create({
    data: {
      name: input.name,
      description: input.description ?? null,
      kind: input.kind,
      templateId: input.templateId ?? null,
      isDefault: input.isDefault,
      configuration: toJsonField(input.configuration),
    },
  });
}

export async function updateResponseView(id: string, input: ResponseViewInput) {
  await getResponseViewOrThrow(id);
  return prisma.responseView.update({
    where: { id },
    data: {
      name: input.name,
      description: input.description ?? null,
      kind: input.kind,
      templateId: input.templateId ?? null,
      isDefault: input.isDefault,
      configuration: toJsonField(input.configuration),
    },
  });
}

export async function deleteResponseView(id: string) {
  await getResponseViewOrThrow(id);
  await prisma.responseView.delete({ where: { id } });
}

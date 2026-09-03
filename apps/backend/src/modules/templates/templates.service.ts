import { prisma } from "../../lib/prisma";
import { fromJsonField, toJsonField } from "../../lib/json-field";
import { AppError } from "../../lib/errors";
import type { ValidationRequestConfig } from "@fad-console/validation-schemas";
import type { ValidationTemplateInput } from "@fad-console/validation-schemas";
import { assertWithinScope, type ClientScope } from "../clients/client-scope";

type TemplateRecord = Awaited<ReturnType<typeof prisma.validationTemplate.findFirstOrThrow>>;

export function toTemplateDto(template: TemplateRecord) {
  return {
    id: template.id,
    name: template.name,
    description: template.description,
    version: template.version,
    environmentId: template.environmentId,
    requestConfig: fromJsonField<ValidationRequestConfig>(template.requestConfig, {
      processName: "",
      validity: 1,
      client: { name: "", mail: "", phone: "" },
      steps: {},
      customization: { theme: [], header: [] },
      feature: {},
      notifications: { email: false, whatsapp: false },
    }),
    active: template.active,
    createdById: template.createdById,
    updatedById: template.updatedById,
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
  };
}

export async function listTemplates(scope?: ClientScope) {
  const where = scope?.allowedIds ? { environment: { clientId: { in: scope.allowedIds } } } : {};
  return prisma.validationTemplate.findMany({ where, orderBy: { createdAt: "desc" } });
}

export async function getTemplateOrThrow(id: string, scope?: ClientScope) {
  const template = await prisma.validationTemplate.findUnique({ where: { id }, include: { environment: true } });
  if (!template) throw AppError.notFound("Plantilla no encontrada");
  if (scope) assertWithinScope(template.environment?.clientId ?? null, scope);
  return template;
}

export async function createTemplate(input: ValidationTemplateInput, userId: string | null) {
  return prisma.validationTemplate.create({
    data: {
      name: input.name,
      description: input.description ?? null,
      environmentId: input.environmentId ?? null,
      requestConfig: toJsonField(input.requestConfig),
      active: input.active,
      createdById: userId,
      updatedById: userId,
    },
  });
}

export async function updateTemplate(id: string, input: ValidationTemplateInput, userId: string | null) {
  const existing = await getTemplateOrThrow(id);
  return prisma.validationTemplate.update({
    where: { id },
    data: {
      name: input.name,
      description: input.description ?? null,
      environmentId: input.environmentId ?? null,
      requestConfig: toJsonField(input.requestConfig),
      active: input.active,
      version: existing.version + 1,
      updatedById: userId,
    },
  });
}

export async function cloneTemplate(id: string, userId: string | null) {
  const existing = await getTemplateOrThrow(id);
  return prisma.validationTemplate.create({
    data: {
      name: `${existing.name} (copia)`,
      description: existing.description,
      environmentId: existing.environmentId,
      requestConfig: existing.requestConfig,
      active: true,
      createdById: userId,
      updatedById: userId,
    },
  });
}

export async function deleteTemplate(id: string) {
  await getTemplateOrThrow(id);
  await prisma.validationTemplate.delete({ where: { id } });
}

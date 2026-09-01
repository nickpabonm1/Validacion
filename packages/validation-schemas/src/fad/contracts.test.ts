import { describe, expect, it } from "vitest";
import { CreateValidationResponseSchema } from "./create-validation.schema";
import { GetValidationStepResponseSchema } from "./get-step.schema";
import { GetValidationDataResponseSchema } from "./get-validation-data.schema";
import { WebhookEnvelopeSchema } from "./webhook.schema";
import {
  createValidationResponseFixture,
  createValidationErrorFixture,
  getValidationStepResponseFixture,
  getValidationDataResponseFixture,
  createdValidationStepWebhookFixture,
  unknownWebhookFixture,
} from "../fixtures";
import { ValidationRequestConfigSchema, pruneEmptyRequestFields } from "../request-builder/template.schema";
import { createValidationRequestFixture } from "../fixtures/create-validation-request.fixture";

describe("FAD contract schemas (fixtures sanitizados)", () => {
  it("valida la respuesta exitosa de creación de validación", () => {
    const result = CreateValidationResponseSchema.safeParse(createValidationResponseFixture);
    expect(result.success).toBe(true);
  });

  it("valida la respuesta de error de creación de validación", () => {
    const result = CreateValidationResponseSchema.safeParse(createValidationErrorFixture);
    expect(result.success).toBe(true);
  });

  it("valida la respuesta de getValidationStep preservando campos dinámicos por paso", () => {
    const result = GetValidationStepResponseSchema.safeParse(getValidationStepResponseFixture);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.data?.steps?.captureId?.configuration).toBeDefined();
    }
  });

  it("valida la respuesta de getValidationData con campos dinámicos/desconocidos", () => {
    const withExtraField = {
      ...getValidationDataResponseFixture,
      data: { ...getValidationDataResponseFixture.data, aFieldNeverDocumented: "value" },
    };
    const result = GetValidationDataResponseSchema.safeParse(withExtraField);
    expect(result.success).toBe(true);
  });

  it("valida el envelope de webhook conocido y uno desconocido sin rechazarlo", () => {
    expect(WebhookEnvelopeSchema.safeParse(createdValidationStepWebhookFixture).success).toBe(true);
    expect(WebhookEnvelopeSchema.safeParse(unknownWebhookFixture).success).toBe(true);
  });

  it("valida el request builder de creación de validación", () => {
    const result = ValidationRequestConfigSchema.safeParse(createValidationRequestFixture);
    expect(result.success).toBe(true);
  });

  it("rechaza órdenes duplicados entre pasos visibles", () => {
    const broken = {
      ...createValidationRequestFixture,
      steps: {
        location: { order: 1, show: true, configuration: {}, features: {} },
        captureId: { order: 1, show: true, configuration: {}, features: {} },
      },
    };
    const result = ValidationRequestConfigSchema.safeParse(broken);
    expect(result.success).toBe(false);
  });

  it("rechaza órdenes no consecutivos entre pasos visibles", () => {
    const broken = {
      ...createValidationRequestFixture,
      steps: {
        location: { order: 1, show: true, configuration: {}, features: {} },
        captureId: { order: 3, show: true, configuration: {}, features: {} },
      },
    };
    const result = ValidationRequestConfigSchema.safeParse(broken);
    expect(result.success).toBe(false);
  });

  it("pruneEmptyRequestFields omite customization/feature/notifications vacíos (transformación del request)", () => {
    const parsed = ValidationRequestConfigSchema.parse({
      processName: "Proceso mínimo",
      validity: 5,
      client: { name: "Cliente", mail: "cliente@example.com", phone: "+573000000000" },
      steps: { location: { order: 1, show: true, configuration: {}, features: {} } },
    });
    const pruned = pruneEmptyRequestFields(parsed) as Record<string, unknown>;

    expect(pruned).not.toHaveProperty("customization");
    expect(pruned).not.toHaveProperty("feature");
    expect(pruned).not.toHaveProperty("notifications");
    const steps = pruned.steps as Record<string, Record<string, unknown>>;
    expect(steps.location).not.toHaveProperty("configuration");
    expect(steps.location).not.toHaveProperty("features");
  });

  it("pruneEmptyRequestFields conserva customization/feature/notifications cuando tienen contenido", () => {
    const parsed = ValidationRequestConfigSchema.parse(createValidationRequestFixture);
    const pruned = pruneEmptyRequestFields(parsed) as Record<string, unknown>;

    expect(pruned).toHaveProperty("customization");
    expect(pruned).toHaveProperty("feature");
    const steps = pruned.steps as Record<string, Record<string, unknown>>;
    expect(steps.captureId).toHaveProperty("features");
  });
});

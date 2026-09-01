import { randomUUID } from "node:crypto";
import type { TestConnectionResultDto } from "@fad-console/shared-types";
import { fixtures } from "@fad-console/validation-schemas";

/**
 * Adaptador simulado — NUNCA se conecta a una API real. Se usa exclusivamente en pruebas
 * automatizadas y en el "modo demostración" explícito de la consola (siempre marcado
 * `isDemo: true` en la ejecución resultante, nunca presentado como una conexión real). Los
 * datos que produce son fixtures sanitizados, no biometría real.
 */
class FadDemoAdapter {
  async testConnection(): Promise<TestConnectionResultDto> {
    return { success: true, message: "Conexión simulada (modo demostración).", tokenType: "bearer", expiresIn: 3600 };
  }

  async createValidation(): Promise<{ status: number; data: typeof fixtures.createValidationResponseFixture }> {
    const validationId = randomUUID();
    return {
      status: 200,
      data: {
        ...fixtures.createValidationResponseFixture,
        data: {
          key: `DEMO-${randomUUID().slice(0, 8)}`,
          vector: `DEMO-${randomUUID().slice(0, 8)}`,
          validationId,
        },
      },
    };
  }

  async getValidationStep(): Promise<{ status: number; data: typeof fixtures.getValidationStepResponseFixture }> {
    return { status: 200, data: fixtures.getValidationStepResponseFixture };
  }

  async getValidationData(): Promise<{ status: number; data: typeof fixtures.getValidationDataResponseFixture }> {
    return { status: 200, data: fixtures.getValidationDataResponseFixture };
  }
}

export const fadDemoAdapter = new FadDemoAdapter();

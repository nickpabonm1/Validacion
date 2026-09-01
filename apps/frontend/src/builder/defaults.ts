import type { BuilderConfig, BuilderStepEntry } from "./types";

export function emptyBuilderConfig(): BuilderConfig {
  return {
    processName: "",
    validity: 5,
    client: { name: "", mail: "", phone: "" },
    steps: {},
    customization: { theme: [], header: [] },
    feature: {},
    notifications: { email: false, whatsapp: false },
  };
}

const STEP_DEFAULT_FEATURES: Record<string, Record<string, unknown>> = {
  captureId: { provider: 1 },
  liveness: { provider: 1 },
  location: { alwaysAskLocation: true },
};

const STEP_DEFAULT_CONFIGURATION: Record<string, Record<string, unknown>> = {
  fingerprints: { fingers: ["L1", "R1"] },
};

const STEP_DEFAULT_INPUT: Record<string, Record<string, unknown>> = {
  formValidationId: { forms: [] },
};

export function defaultStepEntry(order: number): BuilderStepEntry {
  return { order, show: true, configuration: {}, features: {} };
}

export function defaultStepEntryFor(stepKey: string, order: number): BuilderStepEntry {
  return {
    order,
    show: true,
    configuration: { ...(STEP_DEFAULT_CONFIGURATION[stepKey] ?? {}) },
    features: { ...(STEP_DEFAULT_FEATURES[stepKey] ?? {}) },
    input: STEP_DEFAULT_INPUT[stepKey] ? { ...STEP_DEFAULT_INPUT[stepKey] } : undefined,
  };
}

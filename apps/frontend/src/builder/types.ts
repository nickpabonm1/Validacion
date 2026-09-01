import type { ValidationRequestConfig } from "@fad-console/validation-schemas";

export type BuilderConfig = ValidationRequestConfig;
export type BuilderStepEntry = BuilderConfig["steps"][string];

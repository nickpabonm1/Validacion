import type { BuilderStepEntry } from "../types";

export interface StepEditorProps {
  step: BuilderStepEntry;
  onChange: (patch: Partial<BuilderStepEntry>) => void;
}

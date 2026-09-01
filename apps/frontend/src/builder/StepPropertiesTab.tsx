import { RotateCcw } from "lucide-react";
import { getStepCatalogEntry } from "@fad-console/shared-types";
import { Button } from "../components/ui/button";
import { EmptyState } from "../components/ui/misc";
import { Badge } from "../components/ui/badge";
import type { BuilderStepEntry } from "./types";
import { LocationEditor } from "./editors/LocationEditor";
import { PrivacyNoticeEditor } from "./editors/PrivacyNoticeEditor";
import { CaptureIdEditor } from "./editors/CaptureIdEditor";
import { LivenessEditor } from "./editors/LivenessEditor";
import { FingerprintsEditor } from "./editors/FingerprintsEditor";
import { IdDetectionEditor } from "./editors/IdDetectionEditor";
import { FormValidationIdEditor } from "./editors/FormValidationIdEditor";
import { AdvancedJsonEditor } from "./editors/AdvancedJsonEditor";
import type { StepEditorProps } from "./editors/types";

const STRUCTURED_EDITORS: Record<string, (props: StepEditorProps) => JSX.Element> = {
  location: LocationEditor,
  privacyNotice: PrivacyNoticeEditor,
  captureId: CaptureIdEditor,
  liveness: LivenessEditor,
  fingerprints: FingerprintsEditor,
  idDetection: IdDetectionEditor,
  formValidationId: FormValidationIdEditor,
};

interface StepPropertiesTabProps {
  stepKey: string | null;
  step: BuilderStepEntry | undefined;
  onChange: (patch: Partial<BuilderStepEntry>) => void;
  onReset: () => void;
}

export function StepPropertiesTab({ stepKey, step, onChange, onReset }: StepPropertiesTabProps) {
  if (!stepKey || !step) {
    return <EmptyState title="Selecciona un paso" description="Elige un paso del lienzo para configurarlo aquí." />;
  }

  const catalogEntry = getStepCatalogEntry(stepKey);
  const StructuredEditor = STRUCTURED_EDITORS[stepKey];

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">{catalogEntry?.label ?? stepKey}</p>
          <p className="text-xs text-muted-foreground">{catalogEntry?.description}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onReset}>
          <RotateCcw className="h-3.5 w-3.5" /> Restaurar
        </Button>
      </div>

      {catalogEntry?.experimental ? (
        <Badge tone="warning">Paso experimental — no confirmado en el contrato de creación</Badge>
      ) : null}

      {StructuredEditor ? <StructuredEditor step={step} onChange={onChange} /> : null}

      <AdvancedJsonEditor step={step} onChange={onChange} defaultOpen={!StructuredEditor} />
    </div>
  );
}

import { CheckCircle2, XCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { OcrTable } from "./OcrTable";

interface FieldSpec {
  key: string;
  label: string;
}

interface ProviderSpec {
  label: string;
  fields: FieldSpec[];
}

/** Renderers conocidos para las validaciones externas de la sección 18 del brief. Un resultado
 * no reconocido cae a una tabla clave/valor genérica (nunca se descarta ni se muestra como
 * bloque JSON crudo). */
const PROVIDER_SPECS: Record<string, ProviderSpec> = {
  accuant_validation: {
    label: "Validación Accuant (alertas del documento)",
    fields: [
      { key: "validation_result", label: "Resultado" },
      { key: "valid_acceptance_criteria", label: "Criterios válidos" },
      { key: "invalid_acceptance_criteria", label: "Criterios inválidos" },
      { key: "skipped_acceptance_criteria", label: "Criterios omitidos" },
    ],
  },
  comparison_selfie_ine_validation: {
    label: "Comparación selfie vs. documento",
    fields: [
      { key: "validation_result", label: "Resultado" },
      { key: "validation_comparison_percentage", label: "% de comparación" },
      { key: "valid_acceptance_criteria", label: "Criterio mínimo" },
    ],
  },
  validation_big_data_corp_decision_check: {
    label: "Big Data Corp — Decision Check",
    fields: [
      { key: "validation_result", label: "Resultado" },
      { key: "cpf", label: "CPF" },
    ],
  },
  validation_big_data_corp_empresa: {
    label: "Big Data Corp — Empresa",
    fields: [
      { key: "validation_result", label: "Resultado" },
      { key: "cnpj", label: "CNPJ" },
    ],
  },
  validation_big_data_corp_pessoa: {
    label: "Big Data Corp — Pessoa",
    fields: [
      { key: "validation_result", label: "Resultado" },
      { key: "cpf", label: "CPF" },
    ],
  },
  validation_big_data_corp_pessoa_kyc: {
    label: "Big Data Corp — Pessoa KYC",
    fields: [
      { key: "validation_result", label: "Resultado" },
      { key: "cpf", label: "CPF" },
    ],
  },
  validation_serpro: {
    label: "Serpro (identidad / biometría)",
    fields: [
      { key: "has_selfie", label: "Tiene selfie" },
      { key: "has_fingers", label: "Tiene huellas" },
      { key: "both_face_and_digitais_validation", label: "Rostro y huellas validados" },
      { key: "service_face_response_status", label: "Estado servicio rostro" },
      { key: "service_fingers_response_status", label: "Estado servicio huellas" },
    ],
  },
  validation_unico: {
    label: "Unico",
    fields: [
      { key: "has_selfie", label: "Tiene selfie" },
      { key: "unico_face_match_result_done", label: "Coincidencia facial completada" },
      { key: "unico_face_match_validation_uuid", label: "ID de validación" },
      { key: "cpf", label: "CPF" },
    ],
  },
};

function formatValue(value: unknown): { text: string; boolTone?: "success" | "error" } {
  if (typeof value === "boolean") return { text: value ? "Sí" : "No", boolTone: value ? "success" : "error" };
  if (value === null || value === undefined || value === "") return { text: "—" };
  return { text: typeof value === "object" ? JSON.stringify(value) : String(value) };
}

export function ExternalValidationCard({ providerKey, data }: { providerKey: string; data: Record<string, unknown> }) {
  const spec = PROVIDER_SPECS[providerKey];

  if (!spec) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-mono text-sm">{providerKey}</CardTitle>
        </CardHeader>
        <CardContent>
          <OcrTable data={data} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{spec.label}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {spec.fields.map(({ key, label }) => {
          if (!(key in data)) return null;
          const { text, boolTone } = formatValue(data[key]);
          return (
            <div key={key}>
              <p className="text-xs text-muted-foreground">{label}</p>
              {boolTone ? (
                <p className={`flex items-center gap-1 text-sm font-medium ${boolTone === "success" ? "text-success" : "text-destructive"}`}>
                  {boolTone === "success" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                  {text}
                </p>
              ) : (
                <p className="text-sm font-medium">{text}</p>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

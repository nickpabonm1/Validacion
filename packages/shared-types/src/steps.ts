/**
 * Catálogo de pasos del proceso de validación por pasos (Biometrics By Steps).
 * Fuente: "API FAD Web Biometrics By Steps.pdf" v1.4, secciones 2.2 y 3.
 * Los pasos marcados `experimental: true` (enrollFace, authFace) están documentados en la
 * sección "Structure JSON SDK" del PDF, pero no hay evidencia (ni en el PDF ni en la
 * colección Postman) de que el endpoint de creación de validaciones los acepte como parte de
 * `steps`. Se exponen en la consola como avanzados/experimentales, tal como pide el brief.
 */
export type StepKey =
  | "location"
  | "privacyNotice"
  | "securityCode"
  | "captureId"
  | "formValidationId"
  | "liveness"
  | "fingerprints"
  | "videoagreement"
  | "idDetection"
  | "capturePhoto"
  | "customView"
  | "enrollFace"
  | "authFace";

export interface StepCatalogEntry {
  key: StepKey;
  label: string;
  description: string;
  /** Si existe un editor de propiedades dedicado o solo el editor JSON avanzado. */
  hasStructuredEditor: boolean;
  experimental?: boolean;
  duplicable?: boolean;
  defaultConfiguration?: Record<string, unknown>;
  defaultFeatures?: Record<string, unknown>;
}

export const STEP_CATALOG: readonly StepCatalogEntry[] = [
  {
    key: "location",
    label: "Ubicación",
    description: "Captura la geolocalización del dispositivo durante el proceso.",
    hasStructuredEditor: true,
  },
  {
    key: "privacyNotice",
    label: "Aviso de privacidad",
    description: "Presenta un aviso de privacidad que el cliente debe aceptar o rechazar.",
    hasStructuredEditor: true,
  },
  {
    key: "securityCode",
    label: "Código de seguridad",
    description: "Solicita un código de seguridad (OTP) antes de continuar el proceso.",
    hasStructuredEditor: false,
  },
  {
    key: "captureId",
    label: "Captura de identificación",
    description: "Captura frontal y posterior del documento de identidad mediante un proveedor OCR.",
    hasStructuredEditor: true,
    duplicable: false,
  },
  {
    key: "formValidationId",
    label: "Formulario de validación",
    description: "Formulario editable con los datos obtenidos por OCR del documento.",
    hasStructuredEditor: true,
  },
  {
    key: "liveness",
    label: "Prueba de vida",
    description: "Verifica que el usuario es una persona real mediante selfie/liveness.",
    hasStructuredEditor: true,
  },
  {
    key: "fingerprints",
    label: "Huellas dactilares",
    description: "Captura entre 1 y 10 huellas dactilares en formato WSQ y JPEG.",
    hasStructuredEditor: true,
  },
  {
    key: "videoagreement",
    label: "Acuerdo en video",
    description: "Graba un video de aceptación del acuerdo/consentimiento.",
    hasStructuredEditor: true,
  },
  {
    key: "idDetection",
    label: "Detección de identificación",
    description: "Detecta el documento y el rostro durante la lectura del acuerdo en video.",
    hasStructuredEditor: true,
  },
  {
    key: "capturePhoto",
    label: "Captura de foto",
    description: "Captura una fotografía adicional dentro del proceso.",
    hasStructuredEditor: false,
  },
  {
    key: "customView",
    label: "Vista personalizada",
    description: "Paso de contenido personalizado configurado mediante JSON avanzado.",
    hasStructuredEditor: false,
    duplicable: true,
  },
  {
    key: "enrollFace",
    label: "Enrolamiento facial (experimental)",
    description:
      "Captura la foto de enrolamiento facial que luego usará authFace. No confirmado en el " +
      "contrato del endpoint de creación; disponible como paso avanzado/experimental.",
    hasStructuredEditor: true,
    experimental: true,
  },
  {
    key: "authFace",
    label: "Autenticación facial (experimental)",
    description:
      "Compara una selfie contra el enrolamiento facial previo. No confirmado en el contrato " +
      "del endpoint de creación; disponible como paso avanzado/experimental.",
    hasStructuredEditor: true,
    experimental: true,
  },
] as const;

export const STEP_KEYS: readonly StepKey[] = STEP_CATALOG.map((s) => s.key);

export function getStepCatalogEntry(key: string): StepCatalogEntry | undefined {
  return STEP_CATALOG.find((s) => s.key === key);
}

export const FORM_FIELD_INPUT_TYPES = [
  "text",
  "number",
  "document number",
  "email",
  "phone",
  "date",
  "select",
  "checkbox",
] as const;
export type FormFieldInputType = (typeof FORM_FIELD_INPUT_TYPES)[number];

/** Estructura base compartida por todos los JSON del SDK (sección 3 del PDF). */
export interface SdkBaseStructure {
  client: string | null;
  base: {
    idProcess: string | null;
    device?: {
      appVersion?: string;
      platform?: string;
      deviceModel?: string;
      deviceName?: string;
      operatingSystem?: string;
      serialNumber?: string;
      browser?: string;
    };
    location?: {
      latitude?: string;
      longitude?: string;
    } | null;
  };
  step: {
    name: string;
    start: number | string;
    end: number | string;
  };
}

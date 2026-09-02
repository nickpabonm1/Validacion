/**
 * Traducción de la validación de documento (`documentChecks`) al español. Vocabulario CERRADO,
 * transcrito directamente de dos respuestas reales de FAD que el operador compartió: la forma
 * categorizada de Regula (`steps.captureId.data.alerts.{textCrossChecks,authenticity,
 * imageQuality,mrzCheckDigit,dateChecks}`) y la forma plana AssureID de Acuant
 * (`steps.captureId.data.alerts[]` con `Name`/`Key`/`Disposition`). Nunca se inventa una
 * traducción: un texto que no aparece aquí se muestra tal cual lo devolvió FAD (en inglés), en
 * vez de una traducción adivinada.
 */

/** `type.name` (Regula) / `Name` o `Key` (Acuant) — el nombre de cada verificación. */
const CHECK_NAME_ES: Record<string, string> = {
  // Regula — textCrossChecks
  "Surname And Given Names": "Apellidos y nombres",
  Surname: "Apellidos",
  "Given Names": "Nombres",
  "Date of Birth": "Fecha de nacimiento",
  "Document Number": "Número de documento",
  "Issuing State Name": "País emisor",
  "Date of Expiry": "Fecha de vencimiento",
  RemainderTerm: "Término restante",
  Sex: "Sexo",
  Age: "Edad",
  Nationality: "Nacionalidad",
  "Document Class Code": "Código de clase de documento",
  "Issuing State Code": "Código del país emisor",
  "MRZ Strings": "Cadenas MRZ",
  "Personal Number": "Número personal",
  "Document Number Checkdigit": "Dígito verificador del número de documento",
  "Date of Birth Checkdigit": "Dígito verificador de fecha de nacimiento",
  "Final Checkdigit": "Dígito verificador final",
  "Nationality Code": "Código de nacionalidad",
  "Date of Expiry Checkdigit": "Dígito verificador de fecha de vencimiento",
  "Place of Birth": "Lugar de nacimiento",
  "Optional Data": "Datos opcionales",
  Height: "Estatura",
  "Blood Group": "Grupo sanguíneo",
  "Place of Issue": "Lugar de expedición",
  "First Issue Date": "Fecha de primera expedición",
  "Line2 Optional Data": "Datos opcionales (línea 2)",
  "MRZ Type": "Tipo de MRZ",
  // Regula — authenticity / imageQuality / dateChecks
  IMAGE_PATTERN: "Patrón de imagen",
  PHOTO_EMBED_TYPE: "Tipo de inserción de foto",
  LIVENESS: "Prueba de vida del documento",
  IMAGE_FOCUS: "Enfoque de la imagen",
  IMAGE_GLARES: "Reflejos en la imagen",
  PORTRAIT: "Retrato",
  BOUNDS: "Bordes del documento",
  PERSPECTIVE: "Perspectiva",
  IMAGE_RESOLUTION: "Resolución de imagen",
  DOCUMENT_EXPIRY: "Vencimiento del documento",
  // Acuant (AssureID)
  "Birth Date Check Digit": "Dígito verificador de fecha de nacimiento",
  "Birth Date Crosscheck": "Verificación cruzada de fecha de nacimiento",
  "Birth Date Valid": "Fecha de nacimiento válida",
  "Composite Check Digit": "Dígito verificador compuesto",
  "Document Classification": "Clasificación del documento",
  "Document Crosscheck Aggregation": "Verificación cruzada agregada del documento",
  "Document Expired": "Vigencia del documento",
  "Document Number Check Digit": "Dígito verificador del número de documento",
  "Document Number Crosscheck": "Verificación cruzada del número de documento",
  "Document Tampering Detection": "Detección de alteración del documento",
  "Expiration Date Check Digit": "Dígito verificador de fecha de vencimiento",
  "Expiration Date Crosscheck": "Verificación cruzada de fecha de vencimiento",
  "Expiration Date Valid": "Fecha de vencimiento válida",
  "Full Name Crosscheck": "Verificación cruzada del nombre completo",
  "Issue Date Valid": "Fecha de expedición válida",
  "Issuing State Crosscheck": "Verificación cruzada del país emisor",
  "Issuing State Valid": "País emisor válido",
  "Nationality Code Crosscheck": "Verificación cruzada del código de nacionalidad",
  "Nationality Valid": "Nacionalidad válida",
  "Personal Number Crosscheck": "Verificación cruzada del número personal",
  "Series Expired": "Vigencia de la serie del documento",
  "Sex Crosscheck": "Verificación cruzada de sexo",
  "Visible Pattern": "Patrón visible de seguridad",
};

/** `type.description` (Regula, solo en authenticity/imageQuality/dateChecks) — variantes
 * confirmadas en la respuesta real compartida. */
const CHECK_DESCRIPTION_ES: Record<string, string> = {
  "Image patterns presence/absence check (position, shape, color)": "Verificación de presencia/ausencia de patrones de imagen (posición, forma, color)",
  "Owner's photo embedding check (is photo printed or sticked)": "Verificación de inserción de la foto del titular (impresa o pegada)",
  "Document liveness check": "Verificación de prueba de vida del documento",
  "Signals whether image is in focus": "Indica si la imagen está enfocada",
  "Signals glare presence on the image": "Indica si hay reflejos en la imagen",
  "Signals if the portrait is present": "Indica si el retrato está presente",
  "Signals if document is not fully present in the image": "Indica si el documento no está completo en la imagen",
  "Signals if document in the image has prespective distortion above threshold":
    "Indica si el documento tiene distorsión de perspectiva por encima del umbral",
  "Signals if image resolution is below threshold": "Indica si la resolución de la imagen está por debajo del umbral",
  "Indicates the document expiry status": "Indica el estado de vencimiento del documento",
};

/** `result.name` (Regula) / traducción numérica ya hecha a texto en el backend (Acuant). */
const RESULT_LABEL_ES: Record<string, string> = {
  OK: "Correcto",
  WAS_NOT_DONE: "No realizado",
  ERROR: "Error",
  FAILED: "Falló",
  UNKNOWN: "Desconocido",
};

/** `result.description` (Regula, 3 variantes confirmadas) y `Disposition` (Acuant, variantes
 * confirmadas en la respuesta real compartida). */
const RESULT_DESCRIPTION_ES: Record<string, string> = {
  "Check was performed and result is POSITIVE": "La verificación se realizó y el resultado es POSITIVO",
  "Check was NOT PERFORMED": "La verificación NO se realizó",
  "Check was performed and result is NEGATIVE": "La verificación se realizó y el resultado es NEGATIVO",
  "The birth date check digit is correct": "El dígito verificador de la fecha de nacimiento es correcto",
  "The birth dates match": "Las fechas de nacimiento coinciden",
  "The birth date is valid": "La fecha de nacimiento es válida",
  "The composite check digit is correct": "El dígito verificador compuesto es correcto",
  "The document type is supported": "El tipo de documento es compatible",
  "There are not a large number of differences between electronic and human-readable data sources":
    "No hay un número elevado de diferencias entre las fuentes de datos electrónicas y legibles",
  "The document has not expired": "El documento no ha vencido",
  "The document number check digit is correct": "El dígito verificador del número de documento es correcto",
  "The document numbers match": "Los números de documento coinciden",
  "No evidence of document tampering was detected.": "No se detectó evidencia de alteración del documento.",
  "The expiration date check digit is correct": "El dígito verificador de la fecha de vencimiento es correcto",
  "The expiration dates match": "Las fechas de vencimiento coinciden",
  "The expiration date is valid": "La fecha de vencimiento es válida",
  "The full names match": "Los nombres completos coinciden",
  "The issue date is valid": "La fecha de expedición es válida",
  "The issuing state information matches across all data sources.":
    "La información del país emisor coincide en todas las fuentes de datos.",
  "The issuing state is valid": "El país emisor es válido",
  "The nationality codes match": "Los códigos de nacionalidad coinciden",
  "The nationality is valid": "La nacionalidad es válida",
  "The personal numbers match": "Los números personales coinciden",
  "The series has not expired": "La serie del documento sigue vigente",
  "The sexes match": "El sexo coincide",
  "A visible pattern was found": "Se encontró un patrón visible",
};

/** Traduce el nombre de una verificación si está en el vocabulario conocido; si no, devuelve el
 * texto original de FAD (nunca se inventa una traducción para un valor no observado). */
export function translateCheckName(name: string): string {
  return CHECK_NAME_ES[name] ?? name;
}

export function translateCheckDescription(description: string | null): string | null {
  if (description === null) return null;
  return CHECK_DESCRIPTION_ES[description] ?? description;
}

export function translateResultLabel(result: string): string {
  return RESULT_LABEL_ES[result] ?? result;
}

export function translateResultDescription(description: string | null): string | null {
  if (description === null) return null;
  return RESULT_DESCRIPTION_ES[description] ?? description;
}

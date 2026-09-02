import { describe, expect, it } from "vitest";
import {
  translateCheckDescription,
  translateCheckName,
  translateResultDescription,
  translateResultLabel,
} from "./document-check-i18n";

describe("document-check-i18n (vocabulario cerrado, transcrito de respuestas reales de FAD)", () => {
  it("traduce nombres de verificación conocidos de Regula y Acuant", () => {
    expect(translateCheckName("Surname And Given Names")).toBe("Apellidos y nombres");
    expect(translateCheckName("Document Tampering Detection")).toBe("Detección de alteración del documento");
    expect(translateCheckName("IMAGE_FOCUS")).toBe("Enfoque de la imagen");
  });

  it("devuelve el texto original cuando el nombre no está en el vocabulario conocido (nunca inventa una traducción)", () => {
    expect(translateCheckName("Some Future Check Type")).toBe("Some Future Check Type");
  });

  it("traduce las etiquetas de resultado conocidas", () => {
    expect(translateResultLabel("OK")).toBe("Correcto");
    expect(translateResultLabel("WAS_NOT_DONE")).toBe("No realizado");
    expect(translateResultLabel("UNRECOGNIZED_CODE")).toBe("UNRECOGNIZED_CODE");
  });

  it("traduce descripciones de resultado conocidas (Regula y Disposition de Acuant) y preserva null", () => {
    expect(translateResultDescription("Check was performed and result is POSITIVE")).toBe(
      "La verificación se realizó y el resultado es POSITIVO",
    );
    expect(translateResultDescription("No evidence of document tampering was detected.")).toBe(
      "No se detectó evidencia de alteración del documento.",
    );
    expect(translateResultDescription(null)).toBeNull();
    expect(translateResultDescription("Some unseen future sentence.")).toBe("Some unseen future sentence.");
  });

  it("traduce la descripción técnica de cada verificación (type.description de Regula) y preserva null", () => {
    expect(translateCheckDescription("Signals whether image is in focus")).toBe("Indica si la imagen está enfocada");
    expect(translateCheckDescription(null)).toBeNull();
    expect(translateCheckDescription("Some unseen future description.")).toBe("Some unseen future description.");
  });
});

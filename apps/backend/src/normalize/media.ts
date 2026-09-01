import type { NormalizedMediaAsset, NormalizedStep } from "@fad-console/shared-types";

const IMAGE_KEY_HINTS = /^(file|foto|photo|selfie|face|image|picture|fingerprint)/i;
const NON_RENDERABLE_TYPES = new Set(["wsq", "mp4", "video", "webm", "mov"]);
const BASE64_ONLY = /^[A-Za-z0-9+/]+={0,2}$/;
const MIN_IMAGE_LENGTH = 200;

function mimeFromType(type: unknown): string {
  const value = typeof type === "string" ? type.toLowerCase() : "";
  if (value === "png") return "image/png";
  if (value === "jpg" || value === "jpeg" || value === "") return "image/jpeg";
  return `image/${value}`;
}

function toDataUrl(rawValue: string, mimeType: string): string | null {
  const trimmed = rawValue.trim();
  if (trimmed.startsWith("data:")) return trimmed;
  if (trimmed.length < MIN_IMAGE_LENGTH) return null;
  if (!BASE64_ONLY.test(trimmed)) return null;
  return `data:${mimeType};base64,${trimmed}`;
}

/**
 * Recorre recursivamente el `data` de un paso buscando contenido de imagen embebido (base64),
 * tal como lo documentan las estructuras JSON del SDK (sección 3 del PDF): objetos
 * `{name, file, type}` en `captureId`/`liveness`/`idDetection`/huellas, o campos sueltos como
 * `foto`/`face`. No asume una forma fija — es tolerante a campos adicionales o ausentes (ver
 * inconsistencia "campos dinámicos" en docs/technical-analysis.md). Los formatos no
 * renderizables en un <img> (wsq, video) se omiten explícitamente, nunca se descartan datos
 * "por si acaso": solo se filtra lo que el navegador no puede mostrar como imagen.
 */
function scanForImages(
  value: unknown,
  stepKey: string,
  labelHint: string,
  assets: NormalizedMediaAsset[],
  seen: Set<string>,
  depth = 0,
): void {
  if (depth > 8 || value === null || value === undefined) return;

  if (Array.isArray(value)) {
    value.forEach((item, index) => scanForImages(item, stepKey, `${labelHint}[${index}]`, assets, seen, depth + 1));
    return;
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const fileField = typeof record.file === "string" ? record.file : undefined;
    const nameField = typeof record.name === "string" ? record.name : labelHint;
    const typeField = record.type;

    if (fileField && !NON_RENDERABLE_TYPES.has(String(typeField ?? "").toLowerCase())) {
      const dataUrl = toDataUrl(fileField, mimeFromType(typeField));
      if (dataUrl) {
        const id = `${stepKey}:${nameField}`;
        if (!seen.has(id)) {
          seen.add(id);
          assets.push({ id, stepKey, label: nameField, mimeType: mimeFromType(typeField), dataUrl });
        }
      }
    }

    for (const [key, nested] of Object.entries(record)) {
      if (key === "file") continue; // ya procesado arriba
      if (typeof nested === "string" && IMAGE_KEY_HINTS.test(key)) {
        const dataUrl = toDataUrl(nested, "image/jpeg");
        if (dataUrl) {
          const id = `${stepKey}:${key}`;
          if (!seen.has(id)) {
            seen.add(id);
            assets.push({ id, stepKey, label: key, mimeType: "image/jpeg", dataUrl });
          }
          continue;
        }
      }
      scanForImages(nested, stepKey, key, assets, seen, depth + 1);
    }
  }
}

export function extractMediaAssets(steps: NormalizedStep[]): NormalizedMediaAsset[] {
  const assets: NormalizedMediaAsset[] = [];
  const seen = new Set<string>();
  for (const step of steps) {
    scanForImages(step.data, step.key, step.key, assets, seen);
  }
  return assets;
}

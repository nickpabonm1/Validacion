import { useState } from "react";
import { Download, FileVideo, ImageOff } from "lucide-react";
import type { NormalizedFile, NormalizedMediaAsset } from "@fad-console/shared-types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";

interface GalleryItem {
  id: string;
  label: string;
  src: string;
  isVideo: boolean;
}

const VIDEO_EXTENSIONS = /\.(mp4|mov|webm)$/i;

/** Agrupa cada archivo/imagen bajo la misma sección que ya usa el Portal FAD ("Identificaciones",
 * "Biometría facial", "Video"), a partir de patrones reales observados en `fileName`
 * (`image_id_*`, `image_liveness_*`, `video_*`) y del `stepKey` de las imágenes embebidas — nunca
 * se inventa una categoría para un patrón no visto, cae en "Otros archivos". */
const SECTION_ORDER = ["document", "face", "video", "other"] as const;
const SECTION_LABELS: Record<(typeof SECTION_ORDER)[number], string> = {
  document: "Identificación",
  face: "Biometría facial",
  video: "Video",
  other: "Otros archivos",
};

function sectionFor(fileName: string, stepKey?: string): (typeof SECTION_ORDER)[number] {
  const name = fileName.toLowerCase();
  if (VIDEO_EXTENSIONS.test(name) || name.startsWith("video_")) return "video";
  if (name.startsWith("image_id_") || stepKey === "captureId") return "document";
  if (name.startsWith("image_liveness_") || stepKey === "liveness") return "face";
  return "other";
}

function Thumb({ item, onOpen }: { item: GalleryItem; onOpen: () => void }) {
  const [errored, setErrored] = useState(false);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex flex-col gap-1.5 rounded-lg border border-border bg-card p-2 text-left transition-colors hover:border-primary"
    >
      <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-md bg-muted">
        {item.isVideo ? (
          <FileVideo className="h-6 w-6 text-muted-foreground" />
        ) : errored ? (
          <ImageOff className="h-6 w-6 text-muted-foreground" />
        ) : (
          <img src={item.src} alt={item.label} className="h-full w-full object-cover" onError={() => setErrored(true)} />
        )}
      </div>
      <p className="truncate text-xs font-medium text-muted-foreground group-hover:text-foreground">{item.label}</p>
    </button>
  );
}

/** Muestra las imágenes embebidas de los pasos (base64) y los archivos con URL de la validación
 * (vía el proxy autenticado /api/media-proxy) en secciones separadas por tipo de captura
 * (Identificación / Biometría facial / Video / Otros), igual que el Portal FAD, con vista
 * ampliada al hacer clic. Los videos (`.mp4`/`.mov`/`.webm`) se reproducen con `<video>`, nunca
 * con `<img>` (que no puede renderizarlos). */
export function ImageGallery({
  mediaAssets,
  files,
  executionId,
}: {
  mediaAssets: NormalizedMediaAsset[];
  files: NormalizedFile[];
  executionId: string;
}) {
  const [openItem, setOpenItem] = useState<GalleryItem | null>(null);

  const items: (GalleryItem & { section: (typeof SECTION_ORDER)[number] })[] = [
    ...mediaAssets.map((asset) => ({
      id: asset.id,
      label: asset.label,
      src: asset.dataUrl,
      isVideo: false,
      section: sectionFor(asset.label, asset.stepKey),
    })),
    ...files
      .filter((f) => f.fileUrl)
      .map((f, index) => ({
        id: `file-${index}`,
        label: f.fileName,
        src: `/api/media-proxy/${executionId}/${index}`,
        isVideo: VIDEO_EXTENSIONS.test(f.fileName) || f.fileName.toLowerCase().startsWith("video_"),
        section: sectionFor(f.fileName),
      })),
  ];

  if (items.length === 0) return null;

  const bySection = new Map<string, typeof items>();
  for (const item of items) {
    if (!bySection.has(item.section)) bySection.set(item.section, []);
    bySection.get(item.section)!.push(item);
  }

  return (
    <>
      <div className="space-y-4">
        {SECTION_ORDER.filter((s) => bySection.has(s)).map((section) => (
          <div key={section}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{SECTION_LABELS[section]}</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {bySection.get(section)!.map((item) => (
                <Thumb key={item.id} item={item} onOpen={() => setOpenItem(item)} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={Boolean(openItem)} onOpenChange={(open) => !open && setOpenItem(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{openItem?.label}</DialogTitle>
          </DialogHeader>
          {openItem ? (
            <div className="space-y-3">
              {openItem.isVideo ? (
                <video src={openItem.src} controls className="max-h-[60vh] w-full rounded-md" />
              ) : (
                <img src={openItem.src} alt={openItem.label} className="max-h-[60vh] w-full rounded-md object-contain" />
              )}
              <Button variant="outline" size="sm" onClick={() => window.open(openItem.src, "_blank")}>
                <Download className="h-3.5 w-3.5" /> Abrir en pestaña nueva
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

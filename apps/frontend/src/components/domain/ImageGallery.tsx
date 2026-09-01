import { useState } from "react";
import { Download, ImageOff } from "lucide-react";
import type { NormalizedFile, NormalizedMediaAsset } from "@fad-console/shared-types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";

interface GalleryItem {
  id: string;
  label: string;
  src: string;
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
        {errored ? (
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
 * (vía el proxy autenticado /api/media-proxy) en una grilla con vista ampliada. */
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

  const items: GalleryItem[] = [
    ...mediaAssets.map((asset) => ({ id: asset.id, label: asset.label, src: asset.dataUrl })),
    ...files
      .filter((f) => f.fileUrl)
      .map((f, index) => ({ id: `file-${index}`, label: f.fileName, src: `/api/media-proxy/${executionId}/${index}` })),
  ];

  if (items.length === 0) return null;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {items.map((item) => (
          <Thumb key={item.id} item={item} onOpen={() => setOpenItem(item)} />
        ))}
      </div>

      <Dialog open={Boolean(openItem)} onOpenChange={(open) => !open && setOpenItem(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{openItem?.label}</DialogTitle>
          </DialogHeader>
          {openItem ? (
            <div className="space-y-3">
              <img src={openItem.src} alt={openItem.label} className="max-h-[60vh] w-full rounded-md object-contain" />
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

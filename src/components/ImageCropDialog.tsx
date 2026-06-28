import { useCallback, useEffect, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";

type AspectOption = { label: string; value: number | null };

const DEFAULT_ASPECTS: AspectOption[] = [
  { label: "Free", value: null },
  { label: "1:1", value: 1 },
  { label: "4:3", value: 4 / 3 },
  { label: "16:9", value: 16 / 9 },
  { label: "3:4", value: 3 / 4 },
];

async function getCroppedBlob(imageSrc: string, area: Area, mime: string): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = imageSrc;
  });
  // Clamp to image bounds so we never draw empty/transparent regions.
  const sx = Math.max(0, Math.min(area.x, img.naturalWidth));
  const sy = Math.max(0, Math.min(area.y, img.naturalHeight));
  const sw = Math.max(1, Math.min(area.width, img.naturalWidth - sx));
  const sh = Math.max(1, Math.min(area.height, img.naturalHeight - sy));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(sw);
  canvas.height = Math.round(sh);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  const outMime = mime === "image/jpg" ? "image/jpeg" : mime;
  if (outMime === "image/jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Crop failed"))), outMime, 0.92),
  );
}

export function ImageCropDialog({
  open,
  file,
  defaultAspect = null,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  file: File | null;
  defaultAspect?: number | null;
  onCancel: () => void;
  onConfirm: (cropped: File) => void;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspect, setAspect] = useState<number | null>(defaultAspect);
  const [area, setArea] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!file) { setSrc(null); return; }
    const url = URL.createObjectURL(file);
    setSrc(url);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setAspect(defaultAspect);
    return () => URL.revokeObjectURL(url);
  }, [file, defaultAspect]);

  const onCropComplete = useCallback((_: Area, pixels: Area) => setArea(pixels), []);

  async function confirm() {
    if (!src || !area || !file) return;
    setBusy(true);
    try {
      const mime = file.type || "image/png";
      const blob = await getCroppedBlob(src, area, mime);
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const cropped = new File([blob], `cropped-${Date.now()}.${ext}`, { type: mime });
      onConfirm(cropped);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Crop image</DialogTitle></DialogHeader>
        <div className="relative h-[60vh] w-full bg-muted overflow-hidden rounded">
          {src && (
            <Cropper
              image={src}
              crop={crop}
              zoom={zoom}
              aspect={aspect ?? undefined}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              restrictPosition={false}
            />
          )}
        </div>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Zoom</Label>
            <Slider min={1} max={4} step={0.01} value={[zoom]} onValueChange={(v) => setZoom(v[0])} />
          </div>
          <div className="flex flex-wrap gap-2">
            {DEFAULT_ASPECTS.map((a) => (
              <Button
                key={a.label}
                type="button"
                size="sm"
                variant={aspect === a.value ? "default" : "outline"}
                onClick={() => setAspect(a.value)}
              >
                {a.label}
              </Button>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button type="button" onClick={confirm} disabled={busy || !area}>
            {busy ? "Cropping…" : "Apply crop"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

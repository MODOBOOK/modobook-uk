import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";

import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Crop, Upload, X } from "lucide-react";
import { ImageCropDialog } from "@/components/ImageCropDialog";
import { useDemoGuard } from "@/hooks/use-demo-mode";

const TEN_YEARS = 60 * 60 * 24 * 365 * 10;
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

async function compressImageIfNeeded(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml" || file.type === "image/gif") return file;
  if (file.size <= MAX_UPLOAD_BYTES) return file;

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = objectUrl;
    });
    const maxSide = 2400;
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, outputType, 0.86));
    if (!blob || blob.size >= file.size) return file;
    const ext = outputType === "image/png" ? "png" : "jpg";
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.${ext}`, { type: outputType });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function ImageUploader({
  label,
  value,
  onChange,
  profileId,
  folder,
  previewClass = "mt-2 h-16 object-contain rounded",
  cropAspect = null,
}: {
  label: string;
  value: string | null | undefined;
  onChange: (url: string | null) => void;
  profileId: string;
  folder: string;
  previewClass?: string;
  cropAspect?: number | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const demo = useDemoGuard();

  async function uploadFile(file: File) {
    if (demo.blocked()) return;
    if (!profileId) {
      toast.error("Profile not ready yet");
      return;
    }
    setUploading(true);
    try {
      const prepared = await compressImageIfNeeded(file);
      if (prepared.size > MAX_UPLOAD_BYTES) {
        toast.error("Image is too large. Please choose a smaller image or crop it first.");
        return;
      }
      const ext = prepared.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${profileId}/${folder}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("clinic-assets")
        .upload(path, prepared, { upsert: true, contentType: prepared.type });
      if (upErr) throw upErr;
      const { data, error: sErr } = await supabase.storage
        .from("clinic-assets")
        .createSignedUrl(path, TEN_YEARS);
      if (sErr || !data) throw sErr ?? new Error("Failed to sign URL");
      onChange(data.signedUrl);
      toast.success("Uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function pickFile(f: File) {
    if (demo.blocked()) return;
    setPendingFile(f);
    setCropOpen(true);
  }

  async function recropFromUrl() {
    if (!value) return;
    try {
      const res = await fetch(value);
      const blob = await res.blob();
      const file = new File([blob], `recrop-${Date.now()}.png`, { type: blob.type || "image/png" });
      pickFile(file);
    } catch {
      toast.error("Couldn't load image to crop");
    }
  }

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) pickFile(f);
          e.target.value = "";
        }}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
        >
          <Upload className="mr-1.5 h-3.5 w-3.5" />
          {uploading ? "Uploading…" : value ? "Replace image" : "Upload image"}
        </Button>
        {value && (
          <>
            <Button type="button" variant="outline" size="sm" onClick={recropFromUrl} disabled={uploading}>
              <Crop className="mr-1.5 h-3.5 w-3.5" />Crop
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
              <X className="mr-1.5 h-3.5 w-3.5" />Remove
            </Button>
          </>
        )}
      </div>
      {value && <img src={value} alt={label} className={previewClass} />}
      <ImageCropDialog
        open={cropOpen}
        file={pendingFile}
        defaultAspect={cropAspect}
        onCancel={() => { setCropOpen(false); setPendingFile(null); }}
        onConfirm={async (cropped) => {
          setCropOpen(false);
          setPendingFile(null);
          await uploadFile(cropped);
        }}
      />
    </div>
  );
}

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";

import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Crop, Upload, X } from "lucide-react";
import { ImageCropDialog } from "@/components/ImageCropDialog";

const TEN_YEARS = 60 * 60 * 24 * 365 * 10;

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

  async function uploadFile(file: File) {
    if (!profileId) {
      toast.error("Profile not ready yet");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${profileId}/${folder}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("clinic-assets")
        .upload(path, file, { upsert: true, contentType: file.type });
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

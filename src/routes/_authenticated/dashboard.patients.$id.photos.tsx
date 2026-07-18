import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listClientFiles, addClientFile, deleteClientFile, getClient } from "@/lib/clients.functions";
import { getMyProfile } from "@/lib/profiles.functions";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, Trash2, Loader2, Camera } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard/patients/$id/photos")({
  ssr: false,
  component: PhotosPage,
});

const TEN_YEARS = 60 * 60 * 24 * 365 * 10;

function PhotosPage() {
  const { id } = Route.useParams();
  const list = useServerFn(listClientFiles);
  const add = useServerFn(addClientFile);
  const del = useServerFn(deleteClientFile);
  const getP = useServerFn(getMyProfile);
  const getC = useServerFn(getClient);
  const [files, setFiles] = useState<any[] | null>(null);
  const [profileId, setProfileId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function reload() {
    const [rows, p] = await Promise.all([list({ data: { client_id: id } }), getP()]);
    setFiles((rows as any[]).filter(r => r.kind === "photo"));
    if (p && typeof p === "object" && "id" in p) setProfileId((p as any).id);
  }
  useEffect(() => { reload().catch(() => {}); /* eslint-disable-next-line */ }, [id]);

  async function upload(fileList: FileList | null) {
    if (!fileList || !profileId) return;
    setBusy(true);
    try {
      for (const file of Array.from(fileList)) {
        const ext = file.name.split(".").pop()?.toLowerCase() || "png";
        const path = `${profileId}/clients/${id}/photo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
        const { error } = await supabase.storage.from("clinic-assets").upload(path, file, { upsert: false, contentType: file.type });
        if (error) { toast.error(error.message); continue; }
        const { data } = await supabase.storage.from("clinic-assets").createSignedUrl(path, TEN_YEARS);
        if (!data) continue;
        await add({ data: { client_id: id, kind: "photo", url: data.signedUrl, filename: file.name } });
      }
      await reload();
      toast.success("Uploaded");
    } finally { setBusy(false); }
  }

  const grouped = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const f of files ?? []) {
      const d = new Date(f.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(f);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [files]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Before / After timeline</h2>
        <div>
          <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={e => upload(e.target.files)} />
          <Button size="sm" onClick={() => inputRef.current?.click()} disabled={busy}>
            {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Upload className="mr-1.5 h-4 w-4" />}Upload photos
          </Button>
        </div>
      </div>

      {files === null ? (
        <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : files.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">
          <Camera className="mx-auto mb-2 h-8 w-8 opacity-50" />
          No photos yet. Upload before/after images to build a visual timeline.
        </CardContent></Card>
      ) : (
        <div className="space-y-6">
          {grouped.map(([month, items]) => {
            const d = new Date(month + "-01");
            const label = d.toLocaleString(undefined, { month: "long", year: "numeric" });
            return (
              <div key={month}>
                <div className="mb-2 text-sm font-medium text-muted-foreground">{label}</div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {items.map(f => (
                    <div key={f.id} className="group relative aspect-square overflow-hidden rounded-lg border bg-muted">
                      <img src={f.url} alt={f.filename ?? ""} className="h-full w-full object-cover" />
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 text-[10px] text-white">
                        {new Date(f.created_at).toLocaleDateString()}
                      </div>
                      <button
                        onClick={async () => { if (confirm("Delete this photo?")) { await del({ data: { id: f.id } }); reload(); } }}
                        className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition group-hover:opacity-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

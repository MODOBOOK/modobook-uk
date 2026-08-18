import { createServerFn } from "@tanstack/react-start";

export const LEAFLET_BUCKET = "treatment-leaflets";

/**
 * Public: turn a stored leaflet path ("storage:<path>") into a temporary signed URL
 * so patients on the booking page can open the PDF without the bucket being public.
 */
export const getLeafletSignedUrl = createServerFn({ method: "POST" })
  .inputValidator((input: { path: string }) => input)
  .handler(async ({ data }) => {
    const path = String(data.path || "").replace(/^storage:/, "");
    if (!path || path.includes("..")) return { url: null as string | null };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from(LEAFLET_BUCKET)
      .createSignedUrl(path, 60 * 60);
    if (error) return { url: null as string | null };
    return { url: signed?.signedUrl ?? null };
  });

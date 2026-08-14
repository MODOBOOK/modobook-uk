/**
 * Per-associate oversight: everything the host clinic needs on a single
 * associate — their profile, room allocation, compliance documents
 * (contracts, DBS/PVG, insurance) and supervision meetings.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BUCKET = "associate-docs";

async function myProfile(supabase: any, userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("id, slug, clinic_name, full_name, email")
    .eq("user_id", userId)
    .maybeSingle();
  return data as { id: string; slug: string; clinic_name: string | null; full_name: string | null; email: string | null } | null;
}

async function requireLink(admin: any, clinicProfileId: string, id: string) {
  const { data: link } = await admin
    .from("clinic_associates")
    .select("*")
    .eq("id", id)
    .eq("clinic_profile_id", clinicProfileId)
    .maybeSingle();
  if (!link) throw new Error("Associate not found");
  return link;
}

/** One associate: link row, their public profile, rooms/locations and headline stats. */
export const getAssociateDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const prof = await myProfile(context.supabase, context.userId);
    if (!prof) throw new Error("Profile not found");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin: any = supabaseAdmin;

    const link = await requireLink(admin, prof.id, data.id);

    let associate: any = null;
    if (link.associate_profile_id) {
      const { data: p } = await admin
        .from("profiles")
        .select("id, slug, clinic_name, full_name, email, phone, avatar_url, created_at")
        .eq("id", link.associate_profile_id)
        .maybeSingle();
      associate = p ?? null;
    }

    const [{ data: rooms }, { data: locations }, { data: documents }, { data: meetings }] = await Promise.all([
      admin.from("rental_rooms").select("id, name, location_id, quantity").eq("profile_id", prof.id).eq("active", true),
      admin.from("locations").select("id, name").eq("profile_id", prof.id),
      admin.from("associate_documents").select("*").eq("link_id", link.id).order("created_at", { ascending: false }),
      admin.from("associate_meetings").select("*").eq("link_id", link.id).order("met_at", { ascending: false }),
    ]);

    // Headline stats — only where the associate allows the relevant oversight.
    const today = new Date().toISOString().slice(0, 10);
    let patients = 0;
    let upcoming = 0;
    let last30 = 0;
    if (link.associate_profile_id && link.status === "active") {
      if (link.oversight_records) {
        patients =
          (await admin.from("clinic_clients").select("id", { count: "exact", head: true }).eq("profile_id", link.associate_profile_id))
            .count ?? 0;
      }
      if (link.oversight_appointments) {
        upcoming =
          (
            await admin
              .from("appointments")
              .select("id", { count: "exact", head: true })
              .eq("profile_id", link.associate_profile_id)
              .gte("scheduled_date", today)
              .neq("status", "cancelled")
          ).count ?? 0;
        last30 =
          (
            await admin
              .from("appointments")
              .select("id", { count: "exact", head: true })
              .eq("profile_id", link.associate_profile_id)
              .gte("scheduled_date", new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10))
              .lt("scheduled_date", today)
          ).count ?? 0;
      }
    }

    const openIncidents =
      (await admin.from("associate_incidents").select("id", { count: "exact", head: true }).eq("link_id", link.id).is("resolved_at", null))
        .count ?? 0;

    return {
      link,
      associate,
      rooms: (rooms ?? []) as { id: string; name: string; location_id: string | null; quantity: number }[],
      locations: (locations ?? []) as { id: string; name: string }[],
      documents: (documents ?? []) as any[],
      meetings: (meetings ?? []) as any[],
      stats: { patients, upcoming, last30, openIncidents },
    };
  });

/** Upload a compliance file (base64) and attach it to the associate. */
export const uploadAssociateDocumentFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; fileName: string; contentType: string; base64: string }) => d)
  .handler(async ({ data, context }) => {
    const prof = await myProfile(context.supabase, context.userId);
    if (!prof) throw new Error("Profile not found");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin: any = supabaseAdmin;
    const link = await requireLink(admin, prof.id, data.id);

    const bytes = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));
    if (bytes.byteLength > 15 * 1024 * 1024) throw new Error("File must be under 15MB");
    const safe = data.fileName.replace(/[^\w.\-]+/g, "_").slice(-80);
    const path = `${prof.id}/${link.id}/${crypto.randomUUID()}-${safe}`;
    const { error } = await admin.storage.from(BUCKET).upload(path, bytes, {
      contentType: data.contentType || "application/octet-stream",
      upsert: false,
    });
    if (error) throw new Error(error.message);
    return { path, fileName: data.fileName };
  });

export const saveAssociateDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      docId?: string | null;
      id: string;
      kind: string;
      title: string;
      reference_number?: string | null;
      outcome?: string | null;
      issued_on?: string | null;
      expires_on?: string | null;
      file_path?: string | null;
      file_name?: string | null;
      notes?: string | null;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const prof = await myProfile(context.supabase, context.userId);
    if (!prof) throw new Error("Profile not found");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin: any = supabaseAdmin;
    const link = await requireLink(admin, prof.id, data.id);
    if (!data.title.trim()) throw new Error("Give the document a title");

    const payload: Record<string, unknown> = {
      link_id: link.id,
      clinic_profile_id: prof.id,
      associate_profile_id: link.associate_profile_id,
      kind: data.kind,
      title: data.title.trim(),
      reference_number: data.reference_number?.trim() || null,
      outcome: data.outcome?.trim() || null,
      issued_on: data.issued_on || null,
      expires_on: data.expires_on || null,
      notes: data.notes?.trim() || null,
      created_by: context.userId,
    };
    if (data.file_path) {
      payload['file_path'] = data.file_path;
      payload['file_name'] = data.file_name ?? null;
    }

    if (data.docId) {
      const { error } = await admin
        .from("associate_documents")
        .update(payload)
        .eq("id", data.docId)
        .eq("clinic_profile_id", prof.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.docId };
    }
    const { data: row, error } = await admin.from("associate_documents").insert(payload).select("id").maybeSingle();
    if (error) throw new Error(error.message);
    return { ok: true, id: row?.id as string };
  });

export const deleteAssociateDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { docId: string }) => d)
  .handler(async ({ data, context }) => {
    const prof = await myProfile(context.supabase, context.userId);
    if (!prof) throw new Error("Profile not found");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin: any = supabaseAdmin;
    const { data: row } = await admin
      .from("associate_documents")
      .select("id, file_path, clinic_profile_id")
      .eq("id", data.docId)
      .maybeSingle();
    if (!row || row.clinic_profile_id !== prof.id) throw new Error("Not permitted");
    if (row.file_path) {
      try {
        await admin.storage.from(BUCKET).remove([row.file_path]);
      } catch {
        /* best effort */
      }
    }
    const { error } = await admin.from("associate_documents").delete().eq("id", data.docId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Short-lived signed link so the clinic owner can open an uploaded file. */
export const getAssociateDocumentUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { docId: string }) => d)
  .handler(async ({ data, context }) => {
    const prof = await myProfile(context.supabase, context.userId);
    if (!prof) throw new Error("Profile not found");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin: any = supabaseAdmin;
    const { data: row } = await admin
      .from("associate_documents")
      .select("file_path, clinic_profile_id, associate_profile_id")
      .eq("id", data.docId)
      .maybeSingle();
    if (!row?.file_path) throw new Error("No file attached");
    if (row.clinic_profile_id !== prof.id && row.associate_profile_id !== prof.id) throw new Error("Not permitted");
    const { data: signed, error } = await admin.storage.from(BUCKET).createSignedUrl(row.file_path, 300);
    if (error) throw new Error(error.message);
    return { url: signed?.signedUrl as string };
  });

export const saveAssociateMeeting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      meetingId?: string | null;
      id: string;
      met_at: string;
      title: string;
      attendees?: string | null;
      notes?: string | null;
      actions?: string | null;
      next_meeting_on?: string | null;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const prof = await myProfile(context.supabase, context.userId);
    if (!prof) throw new Error("Profile not found");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin: any = supabaseAdmin;
    const link = await requireLink(admin, prof.id, data.id);
    if (!data.title.trim()) throw new Error("Give the meeting a title");

    const payload = {
      link_id: link.id,
      clinic_profile_id: prof.id,
      associate_profile_id: link.associate_profile_id,
      met_at: data.met_at,
      title: data.title.trim(),
      attendees: data.attendees?.trim() || null,
      notes: data.notes?.trim() || null,
      actions: data.actions?.trim() || null,
      next_meeting_on: data.next_meeting_on || null,
      created_by: context.userId,
    };
    if (data.meetingId) {
      const { error } = await admin
        .from("associate_meetings")
        .update(payload)
        .eq("id", data.meetingId)
        .eq("clinic_profile_id", prof.id);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.meetingId };
    }
    const { data: row, error } = await admin.from("associate_meetings").insert(payload).select("id").maybeSingle();
    if (error) throw new Error(error.message);
    return { ok: true, id: row?.id as string };
  });

export const deleteAssociateMeeting = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { meetingId: string }) => d)
  .handler(async ({ data, context }) => {
    const prof = await myProfile(context.supabase, context.userId);
    if (!prof) throw new Error("Profile not found");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin: any = supabaseAdmin;
    const { error } = await admin
      .from("associate_meetings")
      .delete()
      .eq("id", data.meetingId)
      .eq("clinic_profile_id", prof.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

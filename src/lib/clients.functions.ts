import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getProfileId(supabase: any, userId: string) {
  const { data } = await supabase.from("profiles").select("id").eq("user_id", userId).maybeSingle();
  return data?.id ?? null;
}

export const listClients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const profileId = await getProfileId(context.supabase, context.userId);
    if (!profileId) return [];
    const { data, error } = await context.supabase
      .from("clinic_clients").select("*").eq("profile_id", profileId).order("full_name");
    if (error) throw error;
    return data ?? [];
  });

export const getClient = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const profileId = await getProfileId(context.supabase, context.userId);
    if (!profileId) throw new Error("No profile");
    const { data: row, error } = await context.supabase
      .from("clinic_clients").select("*").eq("id", data.id).eq("profile_id", profileId).maybeSingle();
    if (error) throw error;
    if (!row) throw new Error("Not found");
    return row;
  });

type UpsertInput = {
  id?: string;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  dob?: string | null;
  gender?: string | null;
  address?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  postcode?: string | null;
  county?: string | null;
  preferred_contact?: string | null;
  marketing_opt_in?: boolean;
  how_heard?: string | null;
  gp_name?: string | null;
  gp_address?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  group_name?: string | null;
  notes?: string | null;
  avatar_url?: string | null;
  has_allergies?: boolean;
  allergies?: string | null;
  archived?: boolean;
};

export const upsertClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: UpsertInput) => input)
  .handler(async ({ data, context }) => {
    const profileId = await getProfileId(context.supabase, context.userId);
    if (!profileId) throw new Error("Profile not found");
    const payload: any = {
      profile_id: profileId,
      full_name: data.full_name.trim(),
    };
    const optional: (keyof UpsertInput)[] = [
      "email","phone","dob","gender","address","address_line1","address_line2","postcode","county",
      "preferred_contact","how_heard","gp_name","gp_address","emergency_contact_name",
      "emergency_contact_phone","group_name","notes","avatar_url","allergies",
    ];
    for (const k of optional) {
      if (k in data) payload[k] = (data as any)[k] || null;
    }
    if ("marketing_opt_in" in data) payload.marketing_opt_in = !!data.marketing_opt_in;
    if ("has_allergies" in data) payload.has_allergies = !!data.has_allergies;
    if ("archived" in data) payload.archived = !!data.archived;

    if (data.id) {
      const { data: row, error } = await context.supabase
        .from("clinic_clients").update(payload).eq("id", data.id).eq("profile_id", profileId)
        .select().single();
      if (error) throw error;
      return row;
    }
    const { data: row, error } = await context.supabase
      .from("clinic_clients").insert(payload).select().single();
    if (error) throw error;
    return row;
  });

export const deleteClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("clinic_clients").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

/* ---------- Notes ---------- */
export const listClientNotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { client_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("client_notes").select("*").eq("client_id", data.client_id).order("created_at", { ascending: false });
    if (error) throw error;
    return rows ?? [];
  });

export const upsertClientNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id?: string; client_id: string; body: string; visible_to_patient?: boolean }) => d)
  .handler(async ({ data, context }) => {
    const pid = await getProfileId(context.supabase, context.userId);
    if (!pid) throw new Error("No profile");
    const visible = data.visible_to_patient ?? false;
    if (data.id) {
      const { error } = await context.supabase.from("client_notes")
        .update({ body: data.body, visible_to_patient: visible, shared_at: visible ? new Date().toISOString() : null })
        .eq("id", data.id);
      if (error) throw error;
      return { ok: true };
    }
    const { error } = await context.supabase.from("client_notes")
      .insert({ profile_id: pid, client_id: data.client_id, body: data.body, visible_to_patient: visible, shared_at: visible ? new Date().toISOString() : null });
    if (error) throw error;
    return { ok: true };
  });

export const toggleClientNoteVisibility = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; visible: boolean }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("client_notes")
      .update({ visible_to_patient: data.visible, shared_at: data.visible ? new Date().toISOString() : null })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });


export const deleteClientNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("client_notes").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

/* ---------- Files (photos + pdfs) ---------- */
export const listClientFiles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { client_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("client_files").select("*").eq("client_id", data.client_id).order("created_at", { ascending: false });
    if (error) throw error;
    return rows ?? [];
  });

export const addClientFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { client_id: string; kind: "photo" | "pdf"; url: string; filename?: string }) => d)
  .handler(async ({ data, context }) => {
    const pid = await getProfileId(context.supabase, context.userId);
    if (!pid) throw new Error("No profile");
    const { error } = await context.supabase.from("client_files").insert({
      profile_id: pid, client_id: data.client_id, kind: data.kind, url: data.url, filename: data.filename ?? null,
    });
    if (error) throw error;
    return { ok: true };
  });

export const deleteClientFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("client_files").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

/* ---------- Prescriptions ---------- */
export const listClientPrescriptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { client_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("client_prescriptions").select("*").eq("client_id", data.client_id).order("prescribed_on", { ascending: false });
    if (error) throw error;
    return rows ?? [];
  });

export const upsertClientPrescription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    id?: string; client_id: string; product: string; dose?: string; directions?: string; prescribed_on?: string; notes?: string;
  }) => d)
  .handler(async ({ data, context }) => {
    const pid = await getProfileId(context.supabase, context.userId);
    if (!pid) throw new Error("No profile");
    const payload: any = {
      product: data.product,
      dose: data.dose || null,
      directions: data.directions || null,
      prescribed_on: data.prescribed_on || null,
      notes: data.notes || null,
    };
    if (data.id) {
      const { error } = await context.supabase.from("client_prescriptions").update(payload).eq("id", data.id);
      if (error) throw error;
      return { ok: true };
    }
    const { error } = await context.supabase.from("client_prescriptions")
      .insert({ profile_id: pid, client_id: data.client_id, ...payload });
    if (error) throw error;
    return { ok: true };
  });

export const deleteClientPrescription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("client_prescriptions").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

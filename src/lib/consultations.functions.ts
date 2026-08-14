import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getProfileId(supabase: any, userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.id as string | undefined;
}

export const listConsultations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const pid = await getProfileId(supabase, userId);
    if (!pid) return [];
    const { data, error } = await supabase
      .from("consultations")
      .select("id, patient_name, patient_email, patient_phone, status, current_step, created_at, updated_at, completed_at")
      .eq("profile_id", pid)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

export const listConsultationsForPatient = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { email?: string; name?: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const pid = await getProfileId(supabase, userId);
    if (!pid) return [];
    let q = supabase
      .from("consultations")
      .select("id, patient_name, patient_email, status, current_step, created_at, updated_at, completed_at")
      .eq("profile_id", pid)
      .order("updated_at", { ascending: false });
    if (data.email) q = q.ilike("patient_email", data.email);
    else if (data.name) q = q.ilike("patient_name", data.name);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

export const getConsultation = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const pid = await getProfileId(supabase, userId);
    if (!pid) throw new Error("No profile");
    const { data: row, error } = await supabase
      .from("consultations")
      .select("*")
      .eq("id", data.id)
      .eq("profile_id", pid)
      .maybeSingle();
    if (error) throw error;
    if (!row) throw new Error("Not found");
    return row;
  });

export const createConsultation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { patient_name: string; patient_email?: string; patient_phone?: string; appointment_id?: string | null; patient_id?: string | null }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const pid = await getProfileId(supabase, userId);
    if (!pid) throw new Error("No profile");
    const { data: row, error } = await supabase
      .from("consultations")
      .insert({
        profile_id: pid,
        patient_name: data.patient_name,
        patient_email: data.patient_email ?? null,
        patient_phone: data.patient_phone ?? null,
        appointment_id: data.appointment_id ?? null,
        patient_id: data.patient_id ?? null,
      })
      .select("id")
      .single();
    if (error) throw error;
    return row;
  });


export const updateConsultation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; patch: Record<string, any> }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const pid = await getProfileId(supabase, userId);
    if (!pid) throw new Error("No profile");
    const allowed = [
      "patient_name","patient_email","patient_phone","status","current_step",
      "medical","concerns","assessment","before_photos","treatment_plan",
      "consent","after_photos","treatment_log","invoice","notes","completed_at",
    ];
    const patch: Record<string, any> = {};
    for (const k of allowed) if (k in data.patch) patch[k] = data.patch[k];
    const { error } = await supabase
      .from("consultations")
      .update(patch as any)
      .eq("id", data.id)
      .eq("profile_id", pid);
    if (error) throw error;
    // Whenever a signed consent is saved, mirror it onto the patient profile.
    if (patch['consent'] && (patch['consent'] as any).signature) {
      try {
        const { syncConsultationConsent } = await import("@/lib/consultation-consent.server");
        await syncConsultationConsent(supabase, pid, data.id);
      } catch (e) { console.error("[updateConsultation] consent sync failed", e); }
    }
    return { ok: true };
  });


// Mirrors a signed consultation consent onto the patient's profile straight
// away, regardless of whether the consultation has been completed.
export const saveConsultationConsentToProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const pid = await getProfileId(supabase, userId);
    if (!pid) throw new Error("No profile");
    const { syncConsultationConsent } = await import("@/lib/consultation-consent.server");
    return await syncConsultationConsent(supabase, pid, data.id);
  });



export const deleteConsultation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const pid = await getProfileId(supabase, userId);
    if (!pid) throw new Error("No profile");
    const { error } = await supabase.from("consultations").delete().eq("id", data.id).eq("profile_id", pid);
    if (error) throw error;
    return { ok: true };
  });

// Ensures the consultation is linked to a clinic_client so features that
// require a patient record (e.g. sending additional medical forms) work.
// Reuses an existing client (matched by email, then name) or creates a new one.
export const ensureConsultationPatient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const pid = await getProfileId(supabase, userId);
    if (!pid) throw new Error("No profile");

    const { data: cons, error: cErr } = await supabase
      .from("consultations")
      .select("id, patient_id, patient_name, patient_email, patient_phone")
      .eq("id", data.id)
      .eq("profile_id", pid)
      .maybeSingle();
    if (cErr) throw cErr;
    if (!cons) throw new Error("Consultation not found");
    if (cons.patient_id) return { patient_id: cons.patient_id as string };

    let clientId: string | null = null;
    if (cons.patient_email) {
      const { data: existing } = await supabase
        .from("clinic_clients")
        .select("id")
        .eq("profile_id", pid)
        .ilike("email", cons.patient_email)
        .maybeSingle();
      if (existing?.id) clientId = existing.id as string;
    }
    if (!clientId && cons.patient_name) {
      const { data: existing } = await supabase
        .from("clinic_clients")
        .select("id")
        .eq("profile_id", pid)
        .ilike("full_name", cons.patient_name)
        .maybeSingle();
      if (existing?.id) clientId = existing.id as string;
    }
    if (!clientId) {
      const { data: created, error: iErr } = await supabase
        .from("clinic_clients")
        .insert({
          profile_id: pid,
          full_name: cons.patient_name || "Unnamed patient",
          email: cons.patient_email ?? null,
          phone: cons.patient_phone ?? null,
        })
        .select("id")
        .single();
      if (iErr) throw iErr;
      clientId = created.id as string;
    }

    const { error: uErr } = await supabase
      .from("consultations")
      .update({ patient_id: clientId })
      .eq("id", data.id)
      .eq("profile_id", pid);
    if (uErr) throw uErr;

    return { patient_id: clientId };
  });

// Read-only notes derived from a patient's consultations, so they can be
// surfaced inside the Notes section of the patient profile.
export const listConsultationNotesForClient = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { client_id: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const pid = await getProfileId(supabase, userId);
    if (!pid) return [];

    const { data: client } = await supabase
      .from("clinic_clients")
      .select("id, full_name, email")
      .eq("id", data.client_id)
      .eq("profile_id", pid)
      .maybeSingle();
    if (!client) return [];

    const filters = [`patient_id.eq.${client.id}`];
    if (client.email) filters.push(`patient_email.ilike.${client.email}`);
    if (client.full_name) filters.push(`patient_name.ilike.${client.full_name}`);

    const { data: rows, error } = await supabase
      .from("consultations")
      .select("id, created_at, updated_at, completed_at, status, medical, concerns, assessment, treatment_plan, treatment_log, notes")
      .eq("profile_id", pid)
      .or(filters.join(","))
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;

    const text = (v: any): string => {
      if (!v) return "";
      if (typeof v === "string") return v.trim();
      if (typeof v === "object" && typeof v.notes === "string") return v.notes.trim();
      return "";
    };

    const out: any[] = [];
    for (const c of (rows as any[]) ?? []) {
      const parts: { label: string; body: string }[] = [
        { label: "Medical history notes", body: text(c.medical) },
        { label: "Patient concerns", body: text(c.concerns) },
        { label: "Clinical assessment", body: text(c.assessment) },
        { label: "Treatment plan", body: text(c.treatment_plan) },
        { label: "Treatment log", body: text(c.treatment_log) },
        { label: "Consultation notes", body: text(c.notes) },
      ].filter((p) => p.body);

      const products = (c.treatment_log as any)?.products;
      if (Array.isArray(products) && products.length) {
        const lines = products
          .map((p: any) => [p.product || p.name, p.area, p.quantity ? `x${p.quantity}` : null].filter(Boolean).join(" · "))
          .filter(Boolean);
        if (lines.length) parts.push({ label: "Products used", body: lines.join("\n") });
      }

      for (const p of parts) {
        out.push({
          id: `consult:${c.id}:${p.label}`,
          consultation_id: c.id,
          source: "consultation",
          heading: p.label,
          body: p.body,
          visible_to_patient: false,
          created_at: c.completed_at || c.updated_at || c.created_at,
        });
      }
    }
    return out;
  });

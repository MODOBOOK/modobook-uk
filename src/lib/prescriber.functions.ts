import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// ---- Practitioner: list approved prescribers I'm connected to ----
export const listMyConnectedPrescribers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: links, error } = await supabase
      .from("hub_links")
      .select("requester_user_id, recipient_user_id, status")
      .or(`requester_user_id.eq.${userId},recipient_user_id.eq.${userId}`)
      .eq("status", "accepted");
    if (error) throw error;
    const otherIds = (links ?? []).map((l) =>
      l.requester_user_id === userId ? l.recipient_user_id : l.requester_user_id,
    );
    if (otherIds.length === 0) return [];
    // RLS on `prescriber_profiles` blocks cross-user reads, so use the service
    // role once the hub_link between the two users is already accepted — same
    // pattern as `listMyConnectedPractitioners`. Only public-safe fields are
    // returned to the caller.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: codes }, { data: presc }] = await Promise.all([
      supabaseAdmin.from("hub_codes").select("user_id, owner_kind, display_name, code").in("user_id", otherIds),
      supabaseAdmin.from("prescriber_profiles").select("user_id, full_name, status, regulatory_body, fee_per_prescription_pence, fee_per_consult_pence, fee_notes").in("user_id", otherIds),
    ]);
    const prescMap = new Map((presc ?? []).map((p) => [p.user_id, p]));
    return (codes ?? [])
      .filter((c) => c.owner_kind === "prescriber" && prescMap.get(c.user_id)?.status === "approved")
      .map((c) => {
        const p = prescMap.get(c.user_id);
        return {
          user_id: c.user_id,
          name: p?.full_name ?? c.display_name ?? "Prescriber",
          regulatory_body: p?.regulatory_body ?? null,
          code: c.code,
          fee_per_prescription_pence: (p as { fee_per_prescription_pence?: number | null } | undefined)?.fee_per_prescription_pence ?? null,
          fee_per_consult_pence: (p as { fee_per_consult_pence?: number | null } | undefined)?.fee_per_consult_pence ?? null,
          fee_notes: (p as { fee_notes?: string | null } | undefined)?.fee_notes ?? null,
        };
      });
  });

// ---- Prescriber: my fee settings (read) ----
export const getMyPrescriberFees = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("prescriber_profiles")
      .select("fee_per_prescription_pence, fee_per_consult_pence, fee_notes, signoff_pin_hash")
      .eq("user_id", userId)
      .maybeSingle();
    return {
      feeRx: data?.fee_per_prescription_pence ?? null,
      feeConsult: data?.fee_per_consult_pence ?? null,
      feeNotes: data?.fee_notes ?? "",
      hasPin: !!data?.signoff_pin_hash,
    };
  });

// ---- Prescriber: save my fee settings ----
const FeesSchema = z.object({
  fee_per_prescription: z.number().min(0).max(100000).nullable(),
  fee_per_consult: z.number().min(0).max(100000).nullable(),
  fee_notes: z.string().max(500).optional(),
});
export const saveMyPrescriberFees = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: z.infer<typeof FeesSchema>) => FeesSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const toPence = (v: number | null) => (v == null ? null : Math.round(v * 100));
    const { error } = await supabase
      .from("prescriber_profiles")
      .update({
        fee_per_prescription_pence: toPence(data.fee_per_prescription),
        fee_per_consult_pence: toPence(data.fee_per_consult),
        fee_notes: data.fee_notes?.trim() || null,
      } as never)
      .eq("user_id", userId);
    if (error) throw error;
    return { ok: true };
  });

async function hashPin(userId: string, pin: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${userId}::${pin}`));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ---- Prescriber: set/change my quick sign-off PIN ----
export const setSignoffPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { pin: string; current_pin?: string }) => i)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!/^\d{4,6}$/.test(data.pin)) throw new Error("PIN must be 4–6 digits");
    const { data: prof } = await supabase
      .from("prescriber_profiles")
      .select("signoff_pin_hash")
      .eq("user_id", userId)
      .maybeSingle();
    if (!prof) throw new Error("No prescriber profile");
    if (prof.signoff_pin_hash) {
      if (!data.current_pin) throw new Error("Enter your current PIN to change it");
      const current = await hashPin(userId, data.current_pin);
      if (current !== prof.signoff_pin_hash) throw new Error("Current PIN is incorrect");
    }
    const next = await hashPin(userId, data.pin);
    const { error } = await supabase
      .from("prescriber_profiles")
      .update({ signoff_pin_hash: next } as never)
      .eq("user_id", userId);
    if (error) throw error;
    return { ok: true };
  });

// ---- Practitioner: my treatments (id + name + prescriber settings) ----
export const listMyTreatmentsForPrescribing = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("id").eq("user_id", userId).maybeSingle();
    if (!profile) return [];
    const { data, error } = await supabase
      .from("treatments")
      .select("id, name, requires_prescriber, prescriber_user_id, prescriber_routing, prescriber_note, active")
      .eq("profile_id", profile.id)
      .order("name", { ascending: true });
    if (error) throw error;
    return data ?? [];
  });

// ---- Practitioner: save prescriber settings for a treatment ----
const SaveSchema = z.object({
  treatment_id: z.string().uuid(),
  requires_prescriber: z.boolean(),
  prescriber_user_id: z.string().uuid().nullable(),
  prescriber_routing: z.enum(["same_address", "clinic_visit", "in_person_consult"]),
  prescriber_note: z.string().max(2000).nullable().optional(),
});
export const saveTreatmentPrescriberSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: z.infer<typeof SaveSchema>) => SaveSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("id").eq("user_id", userId).maybeSingle();
    if (!profile) throw new Error("No profile");
    if (data.requires_prescriber && !data.prescriber_user_id) {
      throw new Error("Pick a prescriber to require one for this treatment");
    }
    const { error } = await supabase
      .from("treatments")
      .update({
        requires_prescriber: data.requires_prescriber,
        prescriber_user_id: data.requires_prescriber ? data.prescriber_user_id : null,
        prescriber_routing: data.prescriber_routing,
        prescriber_note: data.prescriber_note ?? null,
      } as never)
      .eq("id", data.treatment_id)
      .eq("profile_id", profile.id);
    if (error) throw error;
    return { ok: true };
  });

// ---- Prescriber: my referrals queue (minimal payload) ----
export const listMyReferrals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("prescriber_referrals")
      .select(
        "id, status, routing, created_at, accepted_at, consent_given_at, patient_name, patient_email, practitioner_profile_id, treatment_id, appointment_id, is_walk_in, awaiting_practitioner_close, walk_in_note",
      )
      .eq("prescriber_user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    const profileIds = Array.from(new Set((data ?? []).map((r) => r.practitioner_profile_id)));
    const treatmentIds = Array.from(new Set((data ?? []).map((r) => r.treatment_id).filter(Boolean)));
    const apptIds = Array.from(new Set((data ?? []).map((r) => r.appointment_id).filter(Boolean) as string[]));
    const [{ data: profiles }, { data: treatments }, { data: appts }] = await Promise.all([
      profileIds.length
        ? supabase.from("profiles").select("id, clinic_name, full_name").in("id", profileIds)
        : Promise.resolve({ data: [] as { id: string; clinic_name: string | null; full_name: string | null }[] }),
      treatmentIds.length
        ? supabase.from("treatments").select("id, name").in("id", treatmentIds as string[])
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      apptIds.length
        ? supabase
            .from("appointments")
            .select("id, scheduled_date, start_time, status, location_id")
            .in("id", apptIds)
        : Promise.resolve({
            data: [] as { id: string; scheduled_date: string; start_time: string; status: string; location_id: string | null }[],
          }),
    ]);
    const locIds = Array.from(new Set((appts ?? []).map((a) => a.location_id).filter(Boolean) as string[]));
    const { data: locs } = locIds.length
      ? await supabase.from("locations").select("id, name, city").in("id", locIds)
      : { data: [] as { id: string; name: string; city: string | null }[] };
    const pmap = new Map((profiles ?? []).map((p) => [p.id, p]));
    const tmap = new Map((treatments ?? []).map((t) => [t.id, t]));
    const amap = new Map((appts ?? []).map((a) => [a.id, a]));
    const lmap = new Map((locs ?? []).map((l) => [l.id, l]));
    return (data ?? []).map((r) => {
      const minimal = r.status === "pending" || r.status === "declined";
      const fullName = r.patient_name ?? "";
      const first = fullName.split(" ")[0] ?? "";
      const initial = (fullName.split(" ").slice(1).join(" ")[0] ?? "").toUpperCase();
      const masked = minimal ? `${first}${initial ? " " + initial + "." : ""}` || "Patient" : fullName;
      const t = r.treatment_id ? tmap.get(r.treatment_id) : null;
      const p = pmap.get(r.practitioner_profile_id);
      const a = r.appointment_id ? amap.get(r.appointment_id) : null;
      const loc = a?.location_id ? lmap.get(a.location_id) : null;
      return {
        id: r.id,
        status: r.status as "pending" | "accepted" | "declined" | "completed",
        routing: r.routing as "same_address" | "clinic_visit" | "in_person_consult" | "walk_in",
        created_at: r.created_at,
        accepted_at: r.accepted_at,
        consent_given_at: r.consent_given_at,
        patient_display: masked,
        treatment_name: t?.name ?? (r.is_walk_in ? "Walk-in consult" : "Treatment"),
        clinic_name: p?.clinic_name ?? "Clinic",
        practitioner_name: p?.full_name ?? null,
        location_name: loc ? [loc.name, loc.city].filter(Boolean).join(" · ") : null,
        appointment: a
          ? { id: a.id, scheduled_date: a.scheduled_date, start_time: a.start_time, status: a.status }
          : null,
        is_walk_in: (r as { is_walk_in?: boolean }).is_walk_in ?? false,
        awaiting_practitioner_close: (r as { awaiting_practitioner_close?: boolean }).awaiting_practitioner_close ?? false,
        walk_in_note: (r as { walk_in_note?: string | null }).walk_in_note ?? null,
      };
    });
  });

// ---- Prescriber: decide on a referral (accept / decline / complete + notes) ----
export const updateReferralStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (i: { id: string; action: "accept" | "decline" | "complete"; notes?: string }) => i,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const update: Record<string, unknown> = {};
    if (data.action === "accept") {
      update.status = "accepted";
      update.accepted_at = new Date().toISOString();
    } else if (data.action === "decline") {
      update.status = "declined";
      update.declined_at = new Date().toISOString();
    } else {
      update.status = "completed";
    }
    if (data.notes !== undefined) update.notes = data.notes;
    const { data: row, error } = await supabase
      .from("prescriber_referrals")
      .update(update as never)
      .eq("id", data.id)
      .eq("prescriber_user_id", userId)
      .select()
      .single();
    if (error) throw error;
    return row;
  });

// ---- Prescriber: full record (only after accepted) ----
export const getReferralFull = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    const { data: full, error } = await context.supabase.rpc("prescriber_get_referral_full", {
      p_referral_id: data.id,
    });
    if (error) throw error;
    return { json: JSON.stringify(full ?? null) };
  });

// ---- Practitioner: referrals I've sent (for visibility on my side) ----
export const listSentReferrals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase.from("profiles").select("id").eq("user_id", userId).maybeSingle();
    if (!profile) return [];
    const { data, error } = await supabase
      .from("prescriber_referrals")
      .select("id, status, routing, created_at, accepted_at, patient_name, treatment_id, prescriber_user_id, appointment_id")
      .eq("practitioner_profile_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    const rows = data ?? [];
    const treatmentIds = Array.from(new Set(rows.map((r) => r.treatment_id).filter(Boolean) as string[]));
    const prescIds = Array.from(new Set(rows.map((r) => r.prescriber_user_id).filter(Boolean) as string[]));
    const apptIds = Array.from(new Set(rows.map((r) => r.appointment_id).filter(Boolean) as string[]));
    const [{ data: ts }, { data: presc }, { data: codes }, { data: appts }] = await Promise.all([
      treatmentIds.length
        ? supabase.from("treatments").select("id, name").in("id", treatmentIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      prescIds.length
        ? supabase.from("prescriber_profiles").select("user_id, full_name, regulatory_body").in("user_id", prescIds)
        : Promise.resolve({ data: [] as { user_id: string; full_name: string | null; regulatory_body: string | null }[] }),
      prescIds.length
        ? supabase.from("hub_codes").select("user_id, display_name").in("user_id", prescIds)
        : Promise.resolve({ data: [] as { user_id: string; display_name: string | null }[] }),
      apptIds.length
        ? supabase.from("appointments").select("id, scheduled_date, start_time").in("id", apptIds)
        : Promise.resolve({ data: [] as { id: string; scheduled_date: string; start_time: string }[] }),
    ]);
    const tmap = new Map((ts ?? []).map((t) => [t.id, t]));
    const pmap = new Map((presc ?? []).map((p) => [p.user_id, p]));
    const cmap = new Map((codes ?? []).map((c) => [c.user_id, c]));
    const amap = new Map((appts ?? []).map((a) => [a.id, a]));
    return rows.map((r) => ({
      id: r.id,
      status: r.status as "pending" | "accepted" | "declined" | "completed",
      routing: r.routing as "same_address" | "clinic_visit" | "in_person_consult",
      created_at: r.created_at,
      accepted_at: r.accepted_at,
      patient_name: r.patient_name,
      treatment_name: r.treatment_id ? tmap.get(r.treatment_id)?.name ?? "Treatment" : "Treatment",
      prescriber_name:
        (r.prescriber_user_id && (pmap.get(r.prescriber_user_id)?.full_name ?? cmap.get(r.prescriber_user_id)?.display_name)) ?? "Prescriber",
      prescriber_regulatory_body: r.prescriber_user_id ? pmap.get(r.prescriber_user_id)?.regulatory_body ?? null : null,
      appointment: r.appointment_id && amap.get(r.appointment_id)
        ? { scheduled_date: amap.get(r.appointment_id)!.scheduled_date, start_time: amap.get(r.appointment_id)!.start_time }
        : null,
    }));
  });


// ---- Public (for booking page): treatment prescriber metadata for a slug ----
export const getPrescriberInfoForTreatments = createServerFn({ method: "POST" })
  .inputValidator((i: { slug: string; treatment_ids: string[] }) => i)
  .handler(async ({ data }) => {
    // Read with service role to bypass RLS for a narrow public projection
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!profile) return [];
    const { data: ts } = await supabaseAdmin
      .from("treatments")
      .select("id, name, requires_prescriber, prescriber_user_id, prescriber_routing, prescriber_note")
      .eq("profile_id", profile.id)
      .in("id", data.treatment_ids);
    const list = (ts ?? []).filter((t) => t.requires_prescriber && t.prescriber_user_id);
    if (list.length === 0) return [];
    const prescriberIds = Array.from(new Set(list.map((t) => t.prescriber_user_id as string)));
    const [{ data: codes }, { data: prof }] = await Promise.all([
      supabaseAdmin.from("hub_codes").select("user_id, display_name").in("user_id", prescriberIds),
      supabaseAdmin.from("prescriber_profiles").select("user_id, full_name, regulatory_body").in("user_id", prescriberIds),
    ]);
    const cmap = new Map((codes ?? []).map((c) => [c.user_id, c]));
    const pmap = new Map((prof ?? []).map((p) => [p.user_id, p]));
    // Try to resolve a public booking slug for the prescriber (only if they also have a practitioner profile)
    const { data: profSlugs } = await supabaseAdmin
      .from("profiles")
      .select("user_id, slug, active")
      .in("user_id", prescriberIds);
    const smap = new Map((profSlugs ?? []).filter((p) => p.active).map((p) => [p.user_id, p.slug]));
    return list.map((t) => ({
      treatment_id: t.id,
      treatment_name: t.name,
      routing: t.prescriber_routing as "same_address" | "clinic_visit" | "in_person_consult",
      note: t.prescriber_note,
      prescriber_user_id: t.prescriber_user_id as string,
      prescriber_name:
        pmap.get(t.prescriber_user_id as string)?.full_name ??
        cmap.get(t.prescriber_user_id as string)?.display_name ??
        "Prescriber",
      prescriber_regulatory_body: pmap.get(t.prescriber_user_id as string)?.regulatory_body ?? null,
      prescriber_booking_slug: smap.get(t.prescriber_user_id as string) ?? null,
    }));
  });

// Note: prescriber referrals are now auto-created by the
// `create_referral_for_appointment` database trigger when an appointment
// is inserted for a treatment that requires a prescriber. The trigger
// reads `appointments.clinic_visit_id` so clinic-visit routing works
// without an extra client call.

// ---- Prescriber: fetch own defaults for prefilling prescription letterhead ----
export const getMyPrescriberDefaults = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: presc }, { data: prof }] = await Promise.all([
      supabase
        .from("prescriber_profiles")
        .select("full_name, regulatory_body, regulatory_body_other, registration_number")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("full_name, clinic_name, address")
        .eq("id", userId)
        .maybeSingle(),
    ]);
    const regBody = presc?.regulatory_body === "other"
      ? (presc?.regulatory_body_other ?? "")
      : (presc?.regulatory_body ?? "");
    return {
      prescriber_name: presc?.full_name ?? prof?.full_name ?? "",
      prescriber_reg_body: regBody,
      prescriber_reg_number: presc?.registration_number ?? "",
      clinic_name: prof?.clinic_name ?? "",
      clinic_address: prof?.address ?? "",
    };
  });


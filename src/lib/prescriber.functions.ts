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
    const [{ data: codes }, { data: presc }] = await Promise.all([
      supabase.from("hub_codes").select("user_id, owner_kind, display_name, code").in("user_id", otherIds),
      supabase.from("prescriber_profiles").select("user_id, full_name, status, regulatory_body").in("user_id", otherIds),
    ]);
    const prescMap = new Map((presc ?? []).map((p) => [p.user_id, p]));
    return (codes ?? [])
      .filter((c) => c.owner_kind === "prescriber" && prescMap.get(c.user_id)?.status === "approved")
      .map((c) => ({
        user_id: c.user_id,
        name: prescMap.get(c.user_id)?.full_name ?? c.display_name ?? "Prescriber",
        regulatory_body: prescMap.get(c.user_id)?.regulatory_body ?? null,
        code: c.code,
      }));
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
  prescriber_routing: z.enum(["same_address", "in_person_consult"]),
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
        "id, status, routing, created_at, accepted_at, consent_given_at, patient_name, patient_email, practitioner_profile_id, treatment_id, appointment_id",
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
            .select("id, scheduled_date, start_time, status")
            .in("id", apptIds)
        : Promise.resolve({
            data: [] as { id: string; scheduled_date: string; start_time: string; status: string }[],
          }),
    ]);
    const pmap = new Map((profiles ?? []).map((p) => [p.id, p]));
    const tmap = new Map((treatments ?? []).map((t) => [t.id, t]));
    const amap = new Map((appts ?? []).map((a) => [a.id, a]));
    return (data ?? []).map((r) => {
      const minimal = r.status === "pending" || r.status === "declined";
      const fullName = r.patient_name ?? "";
      const first = fullName.split(" ")[0] ?? "";
      const initial = (fullName.split(" ").slice(1).join(" ")[0] ?? "").toUpperCase();
      const masked = minimal ? `${first}${initial ? " " + initial + "." : ""}` || "Patient" : fullName;
      const t = r.treatment_id ? tmap.get(r.treatment_id) : null;
      const p = pmap.get(r.practitioner_profile_id);
      const a = r.appointment_id ? amap.get(r.appointment_id) : null;
      return {
        id: r.id,
        status: r.status as "pending" | "accepted" | "declined" | "completed",
        routing: r.routing as "same_address" | "in_person_consult",
        created_at: r.created_at,
        accepted_at: r.accepted_at,
        consent_given_at: r.consent_given_at,
        patient_display: masked,
        treatment_name: t?.name ?? "Treatment",
        clinic_name: p?.clinic_name ?? p?.full_name ?? "Clinic",
        appointment: a
          ? { id: a.id, scheduled_date: a.scheduled_date, start_time: a.start_time, status: a.status }
          : null,
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
      .select("id, status, routing, created_at, patient_name, treatment_id, prescriber_user_id")
      .eq("practitioner_profile_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return data ?? [];
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
      routing: t.prescriber_routing as "same_address" | "in_person_consult",
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

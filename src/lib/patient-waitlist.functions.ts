import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isFullName, cleanPatientName, FULL_NAME_MESSAGE } from "@/lib/patient-name";

function publicClient() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

async function activeProfileId(supabase: any, userId: string) {
  const { activeProfileId } = await import("./clinic-context.server");
  return (await activeProfileId(supabase, userId)) ?? null;
}

export type WaitlistJoinInput = {
  slug: string;
  treatmentId?: string | null;
  fullName: string;
  email: string;
  phone?: string | null;
  preferredTimes?: string | null;
  urgency?: string | null;
  notes?: string | null;
};

/** Public: a patient joins a clinic's waitlist when no slots are available. */
export const joinPatientWaitlist = createServerFn({ method: "POST" })
  .inputValidator((input: WaitlistJoinInput) => input)
  .handler(async ({ data }) => {
    const name = cleanPatientName(data.fullName ?? "");
    if (!isFullName(name)) throw new Error(FULL_NAME_MESSAGE);
    const email = (data.email ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Please enter a valid email address");

    const sb = publicClient();
    const { data: profile, error: pErr } = await sb
      .rpc("get_public_profile_by_slug", { p_slug: data.slug.toLowerCase() })
      .single();
    if (pErr || !profile) throw new Error("Clinic not found");
    const profileId = (profile as { id: string }).id;

    const { error } = await sb.from("patient_waitlist").insert({
      profile_id: profileId,
      treatment_id: data.treatmentId || null,
      full_name: name,
      email,
      phone: data.phone?.trim() || null,
      preferred_times: data.preferredTimes?.trim() || null,
      urgency: data.urgency || null,
      notes: data.notes?.trim() || null,
    });
    if (error) throw error;

    // Privileged follow-up: make sure the practitioner has a patient record
    // for this person, and ping their dashboard notifications.
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: existing } = await supabaseAdmin
        .from("clinic_clients")
        .select("id, phone")
        .eq("profile_id", profileId)
        .ilike("email", email)
        .maybeSingle();
      if (!existing) {
        await supabaseAdmin.from("clinic_clients").insert({
          profile_id: profileId,
          full_name: name,
          email,
          phone: data.phone?.trim() || null,
          notes: "Added via the booking-page waitlist",
        });
      } else if (!existing.phone && data.phone?.trim()) {
        await supabaseAdmin
          .from("clinic_clients")
          .update({ phone: data.phone.trim() })
          .eq("id", existing.id);
      }
      await supabaseAdmin.rpc("create_notification", {
        p_profile_id: profileId,
        p_type: "waitlist",
        p_title: "New waitlist request",
        p_body: `${name} joined your waitlist${data.urgency ? ` (${data.urgency})` : ""}.`,
        p_emoji: "⏳",
        p_link: "/dashboard/waitlist",
        p_entity_id: null,
        p_entity_type: "patient_waitlist",
      } as any);
    } catch {
      // Waitlist entry is saved — don't fail the join over the extras.
    }

    return { ok: true };
  });

export type WaitlistEntry = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  preferred_times: string | null;
  urgency: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  treatment_name: string | null;
};

/** Practitioner: list their clinic's waitlist (waiting first, then newest). */
export const listPatientWaitlist = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const profileId = await activeProfileId(context.supabase, context.userId);
    if (!profileId) return [] as WaitlistEntry[];
    const { data, error } = await context.supabase
      .from("patient_waitlist")
      .select("id, full_name, email, phone, preferred_times, urgency, notes, status, created_at, treatments(name)")
      .eq("profile_id", profileId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    const rows = (data ?? []) as any[];
    rows.sort((a, b) => (a.status === "waiting" ? 0 : 1) - (b.status === "waiting" ? 0 : 1));
    return rows.map((r) => ({
      id: r.id,
      full_name: r.full_name,
      email: r.email,
      phone: r.phone,
      preferred_times: r.preferred_times,
      urgency: r.urgency,
      notes: r.notes,
      status: r.status,
      created_at: r.created_at,
      treatment_name: r.treatments?.name ?? null,
    })) as WaitlistEntry[];
  });

/** Practitioner: update an entry's status (waiting / contacted / booked). */
export const updateWaitlistStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; status: string }) => input)
  .handler(async ({ data, context }) => {
    if (!["waiting", "contacted", "booked"].includes(data.status)) throw new Error("Invalid status");
    const profileId = await activeProfileId(context.supabase, context.userId);
    if (!profileId) throw new Error("No profile");
    const { error } = await context.supabase
      .from("patient_waitlist")
      .update({ status: data.status })
      .eq("id", data.id)
      .eq("profile_id", profileId);
    if (error) throw error;
    return { ok: true };
  });

/** Practitioner: remove an entry from the list. */
export const removeWaitlistEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const profileId = await activeProfileId(context.supabase, context.userId);
    if (!profileId) throw new Error("No profile");
    const { error } = await context.supabase
      .from("patient_waitlist")
      .delete()
      .eq("id", data.id)
      .eq("profile_id", profileId);
    if (error) throw error;
    return { ok: true };
  });

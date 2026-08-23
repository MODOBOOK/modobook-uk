import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

async function __activeProfileId(supabase: any, userId: string) {
  const { activeProfileId } = await import("./clinic-context.server");
  return (await activeProfileId(supabase, userId)) ?? "00000000-0000-0000-0000-000000000000";
}

const TimeStr = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/);

const UpsertSchema = z.object({
  id: z.string().uuid().nullable().optional(),
  prescriber_user_id: z.string().uuid().nullable().optional(),
  prescriber_label: z.string().max(120).nullable().optional(),
  location_id: z.string().uuid().nullable().optional(),
  visit_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_time: TimeStr,
  end_time: TimeStr,
  capacity: z.number().int().min(1).max(200),
  notes: z.string().max(1000).nullable().optional(),
  price: z.number().min(0).max(100000).nullable().optional(),
  /** How patients pay for a prescribing clinic slot */
  payment_mode: z.enum(["full", "deposit", "pay_in_clinic"]).nullable().optional(),
  /** 0 = no repeat; otherwise repeat every N days (7 = weekly, 14 = fortnightly, 28 = 4-weekly) */
  repeat_every_days: z.number().int().min(0).max(365).nullable().optional(),
  repeat_until: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
});


// ---- Practitioner: list my upcoming visits with booking counts ----
export const listMyClinicVisits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", await __activeProfileId(supabase, userId))
      .maybeSingle();
    if (!profile) return [];
    const { data, error } = await supabase
      .from("prescriber_clinic_visits")
      .select(
        "id, prescriber_user_id, prescriber_label, location_id, visit_date, start_time, end_time, capacity, notes, status, confirmed_by_prescriber, created_at, price, recurrence_group",
      )
      .eq("practitioner_profile_id", profile.id)
      .gte("visit_date", new Date(Date.now() - 86400000).toISOString().slice(0, 10))
      .order("visit_date", { ascending: true })
      .order("start_time", { ascending: true });
    if (error) throw error;
    const rows = data ?? [];
    if (rows.length === 0) return [];
    const visitIds = rows.map((r) => r.id);
    const prescIds = Array.from(
      new Set(rows.map((r) => r.prescriber_user_id).filter(Boolean) as string[]),
    );
    const locIds = Array.from(new Set(rows.map((r) => r.location_id).filter(Boolean) as string[]));
    const [{ data: presc }, { data: codes }, { data: locs }, { data: refs }] = await Promise.all([
      supabase.from("prescriber_profiles").select("user_id, full_name, regulatory_body").in("user_id", prescIds),
      supabase.from("hub_codes").select("user_id, display_name").in("user_id", prescIds),
      locIds.length
        ? supabase.from("locations").select("id, name").in("id", locIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      supabase
        .from("prescriber_referrals")
        .select("id, clinic_visit_id, status, patient_name, treatment_id")
        .in("clinic_visit_id", visitIds),
    ]);
    const pmap = new Map((presc ?? []).map((p) => [p.user_id, p]));
    const cmap = new Map((codes ?? []).map((c) => [c.user_id, c]));
    const lmap = new Map((locs ?? []).map((l) => [l.id, l]));
    const bookingsByVisit = new Map<string, { id: string; patient_name: string; status: string }[]>();
    for (const r of refs ?? []) {
      if (!r.clinic_visit_id) continue;
      const arr = bookingsByVisit.get(r.clinic_visit_id) ?? [];
      arr.push({ id: r.id, patient_name: r.patient_name ?? "Patient", status: r.status });
      bookingsByVisit.set(r.clinic_visit_id, arr);
    }
    return rows.map((r) => ({
      ...r,
      prescriber_name: r.prescriber_user_id
        ? pmap.get(r.prescriber_user_id)?.full_name ??
          cmap.get(r.prescriber_user_id)?.display_name ??
          r.prescriber_label ??
          "Prescriber"
        : r.prescriber_label ?? "Prescriber",
      prescriber_regulatory_body: r.prescriber_user_id
        ? pmap.get(r.prescriber_user_id)?.regulatory_body ?? null
        : null,
      location_name: r.location_id ? lmap.get(r.location_id)?.name ?? null : null,
      bookings: bookingsByVisit.get(r.id) ?? [],
    }));
  });

// ---- Practitioner: create or update a visit (with optional price + repeat) ----
export const upsertClinicVisit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: z.infer<typeof UpsertSchema>) => UpsertSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", await __activeProfileId(supabase, userId))
      .maybeSingle();
    if (!profile) throw new Error("No profile");

    // Ensure a bookable "Prescribing clinic" treatment exists so the clinic days
    // show up as a normal category on the booking page, with a price attached.
    const ensureTreatment = async (price: number | null) => {
      if (price == null) return null;
      let categoryId: string | null = null;
      const { data: cat } = await supabase
        .from("treatment_categories")
        .select("id")
        .eq("profile_id", profile.id)
        .eq("name", "Prescribing clinic")
        .maybeSingle();
      if (cat) categoryId = cat.id;
      else {
        const { data: newCat } = await supabase
          .from("treatment_categories")
          .insert({ profile_id: profile.id, name: "Prescribing clinic", kind: "treatment" } as never)
          .select("id")
          .single();
        categoryId = newCat?.id ?? null;
      }

      const { data: existing } = await supabase
        .from("treatments")
        .select("id")
        .eq("profile_id", profile.id)
        .eq("name", "Prescribing clinic")
        .maybeSingle();

      const mins = (() => {
        const [sh, sm] = data.start_time.split(":").map(Number);
        const [eh, em] = data.end_time.split(":").map(Number);
        const d = eh * 60 + em - (sh * 60 + sm);
        return d > 0 && d <= 120 ? d : 30;
      })();

      if (existing) {
        await supabase
          .from("treatments")
          .update({
            price,
            active: true,
            category_id: categoryId,
            requires_prescriber: true,
            prescriber_routing: "clinic_visit",
            payment_mode: data.payment_mode ?? "full",
          } as never)
          .eq("id", existing.id);
        return existing.id as string;
      }
      const { data: created, error: tErr } = await supabase
        .from("treatments")
        .insert({
          profile_id: profile.id,
          name: "Prescribing clinic",
          description:
            "Appointment with our prescriber during a prescribing clinic day. Choose your clinic date at checkout.",
          duration: mins,
          price,
          category_id: categoryId,
          payment_mode: data.payment_mode ?? "full",
          requires_prescriber: true,
          prescriber_routing: "clinic_visit",
          prescriber_user_id: data.prescriber_user_id ?? null,
        } as never)
        .select("id")
        .single();
      if (tErr) throw tErr;
      return created.id as string;
    };

    const price = data.price ?? null;
    const treatmentId = await ensureTreatment(price);

    if (data.id) {
      const { error } = await supabase
        .from("prescriber_clinic_visits")
        .update({
          prescriber_user_id: data.prescriber_user_id ?? null,
          prescriber_label: data.prescriber_label?.trim() || null,
          location_id: data.location_id ?? null,
          visit_date: data.visit_date,
          start_time: data.start_time,
          end_time: data.end_time,
          capacity: data.capacity,
          notes: data.notes ?? null,
          price,
          treatment_id: treatmentId,
        } as never)
        .eq("id", data.id)
        .eq("practitioner_profile_id", profile.id);
      if (error) throw error;
      return { id: data.id, created: 1 };
    }

    // Build the list of dates (single date, or a repeating series)
    const dates: string[] = [data.visit_date];
    const step = data.repeat_every_days ?? 0;
    if (step > 0 && data.repeat_until) {
      const until = new Date(`${data.repeat_until}T00:00:00Z`).getTime();
      let cursor = new Date(`${data.visit_date}T00:00:00Z`).getTime();
      while (dates.length < 60) {
        cursor += step * 86400000;
        if (cursor > until) break;
        dates.push(new Date(cursor).toISOString().slice(0, 10));
      }
    }

    const groupId = dates.length > 1 ? crypto.randomUUID() : null;
    const rows = dates.map((d) => ({
      practitioner_profile_id: profile.id,
      prescriber_user_id: data.prescriber_user_id ?? null,
      prescriber_label: data.prescriber_label?.trim() || null,
      location_id: data.location_id ?? null,
      confirmed_by_prescriber: data.prescriber_user_id ? false : true,
      visit_date: d,
      start_time: data.start_time,
      end_time: data.end_time,
      capacity: data.capacity,
      notes: data.notes ?? null,
      price,
      treatment_id: treatmentId,
      recurrence_group: groupId,
      created_by: "practitioner",
    }));

    const { data: inserted, error } = await supabase
      .from("prescriber_clinic_visits")
      .insert(rows as never)
      .select("id");
    if (error) throw error;
    return { id: inserted?.[0]?.id as string, created: inserted?.length ?? 0 };
  });


// ---- Practitioner: cancel/delete a visit ----
export const cancelClinicVisit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string; whole_series?: boolean }) => i)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", await __activeProfileId(supabase, userId))
      .maybeSingle();
    if (!profile) throw new Error("No profile");
    let query = supabase
      .from("prescriber_clinic_visits")
      .update({ status: "cancelled" } as never)
      .eq("practitioner_profile_id", profile.id);
    if (data.whole_series) {
      const { data: row } = await supabase
        .from("prescriber_clinic_visits")
        .select("recurrence_group")
        .eq("id", data.id)
        .maybeSingle();
      const group = (row as { recurrence_group?: string | null } | null)?.recurrence_group;
      query = group
        ? query.eq("recurrence_group", group).gte("visit_date", new Date().toISOString().slice(0, 10))
        : query.eq("id", data.id);
    } else {
      query = query.eq("id", data.id);
    }
    const { error } = await query;
    if (error) throw error;

    return { ok: true };
  });

// ---- Prescriber: my upcoming visits across all practitioners ----
export const listMyPrescriberVisits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("list_my_prescriber_visits");
    if (error) throw error;
    return (data ?? []) as Array<{
      visit_id: string;
      visit_date: string;
      start_time: string;
      end_time: string;
      capacity: number;
      notes: string | null;
      status: string;
      confirmed_by_prescriber: boolean;
      clinic_name: string | null;
      practitioner_profile_id: string;
      location_name: string | null;
      address_line1: string | null;
      city: string | null;
      postcode: string | null;
      bookings: Array<{ referral_id: string; patient_name: string; treatment_id: string; status: string }>;
    }>;
  });

// ---- Prescriber: confirm / unconfirm a visit ----
export const setVisitConfirmation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string; confirmed: boolean }) => i)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("prescriber_clinic_visits")
      .update({ confirmed_by_prescriber: data.confirmed } as never)
      .eq("id", data.id)
      .eq("prescriber_user_id", userId);
    if (error) throw error;
    return { ok: true };
  });

// ---- Public (booking page): list available visits for the chosen treatments ----
export const listAvailableVisitsForBooking = createServerFn({ method: "POST" })
  .inputValidator((i: { slug: string; treatment_ids: string[] }) => i)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("list_clinic_visits_for_slug", {
      p_slug: data.slug,
      p_treatment_ids: data.treatment_ids,
    });
    if (error) throw error;
    return (rows ?? []) as Array<{
      visit_id: string;
      treatment_id: string;
      prescriber_user_id: string;
      prescriber_name: string;
      location_id: string | null;
      location_name: string | null;
      visit_date: string;
      start_time: string;
      end_time: string;
      remaining_capacity: number;
      notes: string | null;
    }>;
  });

/* ============================================================
   Prescriber-initiated clinic-day requests
   ============================================================ */

// ---- Prescriber: list practitioners I'm connected to (for request form) ----
// NOTE: reads practitioner profile + locations via the service role because
// standard RLS on `profiles` / `locations` does not let a prescriber read a
// linked practitioner's row. Safe: we only expose partners of an already
// ACCEPTED hub_link, and only minimal fields.
export const listMyConnectedPractitioners = createServerFn({ method: "GET" })
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

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, user_id, clinic_name, full_name")
      .in("user_id", otherIds);
    const profileIds = (profiles ?? []).map((p) => p.id);
    const { data: locs } = profileIds.length
      ? await supabaseAdmin
          .from("locations")
          .select("id, name, profile_id")
          .in("profile_id", profileIds)
      : { data: [] as { id: string; name: string; profile_id: string }[] };

    const locsByProfile = new Map<string, { id: string; name: string }[]>();
    for (const l of locs ?? []) {
      const arr = locsByProfile.get(l.profile_id) ?? [];
      arr.push({ id: l.id, name: l.name });
      locsByProfile.set(l.profile_id, arr);
    }
    return (profiles ?? []).map((p) => ({
      profile_id: p.id,
      name: p.clinic_name ?? p.full_name ?? "Clinic",
      locations: locsByProfile.get(p.id) ?? [],
    }));
  });


// ---- Prescriber: request a clinic-day at a connected practitioner ----
const RequestSchema = z.object({
  practitioner_profile_id: z.string().uuid(),
  location_id: z.string().uuid().nullable().optional(),
  visit_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  capacity: z.number().int().min(1).max(200),
  notes: z.string().max(1000).nullable().optional(),
});
export const requestClinicVisitAsPrescriber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: z.infer<typeof RequestSchema>) => RequestSchema.parse(i))
  .handler(async ({ data, context }) => {
    // Resolve practitioner's user_id and verify an accepted hub link exists.
    // Use admin client because RLS on profiles blocks reading other users' rows.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prof } = await supabaseAdmin
      .from("profiles").select("user_id").eq("id", data.practitioner_profile_id).maybeSingle();
    const practitionerUserId = (prof as { user_id: string } | null)?.user_id;
    if (!practitionerUserId) throw new Error("Practitioner not found.");


    const { data: link } = await context.supabase
      .from("hub_links")
      .select("id")
      .eq("status", "accepted")
      .or(
        `and(requester_user_id.eq.${context.userId},recipient_user_id.eq.${practitionerUserId}),` +
        `and(recipient_user_id.eq.${context.userId},requester_user_id.eq.${practitionerUserId})`
      )
      .maybeSingle();
    if (!link) {
      throw new Error("You aren't linked to this practitioner yet. Ask them to accept your hub link first.");
    }

    const { data: row, error } = await context.supabase
      .from("prescriber_clinic_visits")
      .insert({
        practitioner_profile_id: data.practitioner_profile_id,
        prescriber_user_id: context.userId,
        location_id: data.location_id ?? null,
        visit_date: data.visit_date,
        start_time: data.start_time,
        end_time: data.end_time,
        capacity: data.capacity,
        notes: data.notes ?? null,
        created_by: "prescriber",
        status: "pending_approval",
        confirmed_by_prescriber: true,
      } as never)
      .select("id")
      .single();
    if (error) throw error;
    return { id: (row as { id: string }).id };
  });

// ---- Practitioner: approve / decline a prescriber-requested visit ----
export const approveClinicVisitRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("approve_prescriber_clinic_visit", { p_id: data.id });
    if (error) throw error;
    return { ok: true };
  });

export const declineClinicVisitRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => i)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("decline_prescriber_clinic_visit", { p_id: data.id });
    if (error) throw error;
    return { ok: true };
  });


// ---- Public (booking page): upcoming prescribing clinic days for a clinic ----
export const listPublicClinicVisits = createServerFn({ method: "GET" })
  .inputValidator((i: { slug: string; locationId?: string | null }) => i)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin
      .rpc("get_public_profile_by_slug", { p_slug: data.slug.toLowerCase() })
      .single();
    const profileId = (profile as { id?: string } | null)?.id;
    if (!profileId) return [];

    const today = new Date().toISOString().slice(0, 10);
    let q = supabaseAdmin
      .from("prescriber_clinic_visits")
      .select("id, prescriber_user_id, prescriber_label, location_id, visit_date, start_time, end_time, capacity, notes, status, price, treatment_id")
      .eq("practitioner_profile_id", profileId)
      .gte("visit_date", today)
      .in("status", ["scheduled", "confirmed", "approved"])
      .order("visit_date", { ascending: true })
      .order("start_time", { ascending: true })
      .limit(30);
    if (data.locationId) q = q.or(`location_id.eq.${data.locationId},location_id.is.null`);
    const { data: rows, error } = await q;
    if (error) throw error;
    const list = rows ?? [];
    if (list.length === 0) return [];

    const visitIds = list.map((r) => r.id);
    const prescIds = Array.from(
      new Set(list.map((r) => r.prescriber_user_id).filter(Boolean) as string[]),
    );
    const locIds = Array.from(new Set(list.map((r) => r.location_id).filter(Boolean) as string[]));
    const [{ data: presc }, { data: locs }, { data: refs }] = await Promise.all([
      supabaseAdmin.from("prescriber_profiles").select("user_id, full_name").in("user_id", prescIds),
      locIds.length
        ? supabaseAdmin.from("locations").select("id, name").in("id", locIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      supabaseAdmin
        .from("prescriber_referrals")
        .select("id, clinic_visit_id, status")
        .in("clinic_visit_id", visitIds),
    ]);
    const pmap = new Map((presc ?? []).map((p) => [p.user_id, p.full_name]));
    const lmap = new Map((locs ?? []).map((l) => [l.id, l.name]));
    const booked = new Map<string, number>();
    for (const r of refs ?? []) {
      if (!r.clinic_visit_id || r.status === "cancelled" || r.status === "declined") continue;
      booked.set(r.clinic_visit_id, (booked.get(r.clinic_visit_id) ?? 0) + 1);
    }

    return list.map((r) => ({
      id: r.id,
      visit_date: r.visit_date,
      start_time: r.start_time,
      end_time: r.end_time,
      notes: r.notes,
      prescriber_name:
        (r.prescriber_user_id ? pmap.get(r.prescriber_user_id) : null) ??
        r.prescriber_label ??
        "Independent prescriber",
      location_name: r.location_id ? lmap.get(r.location_id) ?? null : null,
      remaining: Math.max(0, r.capacity - (booked.get(r.id) ?? 0)),
      price: (r as { price?: number | null }).price ?? null,
      treatment_id: (r as { treatment_id?: string | null }).treatment_id ?? null,
    }));
  });

// ---- Public: treatments tied to prescribing clinic days that have no upcoming dates ----
export const listPublicStaleClinicTreatments = createServerFn({ method: "GET" })
  .inputValidator((i: { slug: string }) => i)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin
      .rpc("get_public_profile_by_slug", { p_slug: data.slug.toLowerCase() })
      .single();
    const profileId = (profile as { id?: string } | null)?.id;
    if (!profileId) return { hiddenTreatmentIds: [] as string[] };

    const today = new Date().toISOString().slice(0, 10);
    const { data: rows } = await supabaseAdmin
      .from("prescriber_clinic_visits")
      .select("treatment_id, visit_date, status")
      .eq("practitioner_profile_id", profileId)
      .not("treatment_id", "is", null);

    const linked = new Set<string>();
    const live = new Set<string>();
    for (const r of rows ?? []) {
      const tid = (r as { treatment_id?: string | null }).treatment_id;
      if (!tid) continue;
      linked.add(tid);
      const status = (r as { status?: string | null }).status ?? "";
      const date = (r as { visit_date?: string | null }).visit_date ?? "";
      if (date >= today && ["scheduled", "confirmed", "approved"].includes(status)) live.add(tid);
    }
    return { hiddenTreatmentIds: Array.from(linked).filter((id) => !live.has(id)) };
  });

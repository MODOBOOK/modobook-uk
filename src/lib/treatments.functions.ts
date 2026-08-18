import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function getServerSupabasePublic() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    },
  );
}

export const getMyTreatments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", context.userId)
      .single();
    if (error) throw error;
    const { data: treatments, error: tErr } = await supabase
      .from("treatments")
      .select("*")
      .eq("profile_id", data.id)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    if (tErr) throw tErr;

    return treatments;
  });

export const createTreatment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      name: string;
      duration: number;
      price: number;
      description?: string;
      timing_notes?: string;
      consent_form_url?: string;
      picture_url?: string;
      payment_mode?: Database["public"]["Enums"]["payment_mode"];
      deposit_amount?: number;
      is_consultation?: boolean;
      deductible_against?: string[];
      deductible_window_days?: number;
      category_id?: string | null;
      active?: boolean;
      session_count?: number;
      allow_split_payment?: boolean;
      rebook_reminder_days?: number | null;
      topup_reminder_days?: number | null;
      session_interval_days?: number | null;
      color?: string | null;


    }) => input,

  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("user_id", context.userId)
      .single();
    if (error) throw error;
    const { data: treatment, error: tErr } = await supabase
      .from("treatments")
      .insert({
        profile_id: profile.id,
        name: data.name,
        duration: data.duration,
        price: data.price,
        description: data.description,
        timing_notes: data.timing_notes,
        consent_form_url: data.consent_form_url,
        picture_url: data.picture_url,
        payment_mode: data.payment_mode ?? "full",
        deposit_amount: data.deposit_amount,
        is_consultation: data.is_consultation ?? false,
        deductible_against: data.deductible_against,
        deductible_window_days: data.deductible_window_days,
        category_id: data.category_id ?? null,
        active: data.active ?? true,
        session_count: data.session_count ?? 1,
        allow_split_payment: data.allow_split_payment ?? false,
        rebook_reminder_days: data.rebook_reminder_days ?? null,
        topup_reminder_days: data.topup_reminder_days ?? null,
        session_interval_days: data.session_interval_days ?? null,
        color: data.color ?? null,
      } as never)


      .select()
      .single();
    if (tErr) throw tErr;
    return treatment;
  });

export const updateTreatment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id: string;
      name?: string;
      duration?: number;
      price?: number;
      description?: string;
      timing_notes?: string;
      consent_form_url?: string;
      picture_url?: string;
      payment_mode?: Database["public"]["Enums"]["payment_mode"];
      deposit_amount?: number | null;

      active?: boolean;
      is_consultation?: boolean;
      deductible_against?: string[];
      deductible_window_days?: number;
      category_id?: string | null;
      session_count?: number;
      allow_split_payment?: boolean;
      rebook_reminder_days?: number | null;
      topup_reminder_days?: number | null;
      session_interval_days?: number | null;
      color?: string | null;

      addon_mode?: "off" | "optional";
      discount_percent?: number | null;
      discount_starts_at?: string | null;
      discount_ends_at?: string | null;
      discount_show_was_now?: boolean;
      discount_label?: string | null;
      aftercare_html?: string | null;
      aftercare_delay_hours?: number;
      auto_send_medical_forms?: boolean;
      auto_send_aftercare?: boolean;
      price_mode?: "fixed" | "from" | "poa" | "free";
      badge?: "recommended" | "popular" | "new" | "bestseller" | null;
      requires_prescriber?: boolean;
      prescriber_user_id?: string | null;
      prescriber_routing?: "same_address" | "clinic_visit" | "in_person_consult";
      prescriber_note?: string | null;
      booking_cap?: number | null;
      leaflet_title?: string | null;
      leaflet_html?: string | null;
      leaflet_url?: string | null;
    }) => input,





  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const update: Record<string, unknown> = {};
    if (data.name !== undefined) update.name = data.name;
    if (data.duration !== undefined) update.duration = data.duration;
    if (data.price !== undefined) update.price = data.price;
    if (data.description !== undefined) update.description = data.description;
    if (data.timing_notes !== undefined) update.timing_notes = data.timing_notes;
    if (data.consent_form_url !== undefined) update.consent_form_url = data.consent_form_url;
    if (data.picture_url !== undefined) update.picture_url = data.picture_url;
    if (data.payment_mode !== undefined) update.payment_mode = data.payment_mode;
    if (data.deposit_amount !== undefined) update.deposit_amount = data.deposit_amount;
    if (data.active !== undefined) update.active = data.active;
    if (data.is_consultation !== undefined) update.is_consultation = data.is_consultation;
    if (data.deductible_against !== undefined) update.deductible_against = data.deductible_against;
    if (data.deductible_window_days !== undefined) update.deductible_window_days = data.deductible_window_days;
    if (data.category_id !== undefined) update.category_id = data.category_id;
    if (data.session_count !== undefined) update.session_count = data.session_count;
    if (data.allow_split_payment !== undefined) update.allow_split_payment = data.allow_split_payment;
    if (data.rebook_reminder_days !== undefined) update.rebook_reminder_days = data.rebook_reminder_days;
    if (data.topup_reminder_days !== undefined) update.topup_reminder_days = data.topup_reminder_days;
    if (data.session_interval_days !== undefined) update.session_interval_days = data.session_interval_days;

    if (data.color !== undefined) update.color = data.color;
    if (data.addon_mode !== undefined) update.addon_mode = data.addon_mode;
    if (data.discount_percent !== undefined) update.discount_percent = data.discount_percent;
    if (data.discount_starts_at !== undefined) update.discount_starts_at = data.discount_starts_at;
    if (data.discount_ends_at !== undefined) update.discount_ends_at = data.discount_ends_at;
    if (data.discount_show_was_now !== undefined) update.discount_show_was_now = data.discount_show_was_now;
    if (data.discount_label !== undefined) update.discount_label = data.discount_label;
    if (data.aftercare_html !== undefined) update.aftercare_html = data.aftercare_html;
    if (data.aftercare_delay_hours !== undefined) update.aftercare_delay_hours = data.aftercare_delay_hours;
    if (data.auto_send_medical_forms !== undefined) update.auto_send_medical_forms = data.auto_send_medical_forms;
    if (data.auto_send_aftercare !== undefined) update.auto_send_aftercare = data.auto_send_aftercare;
    if (data.price_mode !== undefined) update.price_mode = data.price_mode;
    if (data.badge !== undefined) update.badge = data.badge;
    if (data.requires_prescriber !== undefined) update.requires_prescriber = data.requires_prescriber;
    if (data.prescriber_user_id !== undefined) update.prescriber_user_id = data.prescriber_user_id;
    if (data.prescriber_routing !== undefined) update.prescriber_routing = data.prescriber_routing;
    if (data.prescriber_note !== undefined) update.prescriber_note = data.prescriber_note;
    if (data.booking_cap !== undefined) update.booking_cap = data.booking_cap;
    if (data.leaflet_title !== undefined) update.leaflet_title = data.leaflet_title;
    if (data.leaflet_html !== undefined) update.leaflet_html = data.leaflet_html;
    if (data.leaflet_url !== undefined) update.leaflet_url = data.leaflet_url;




    const { data: treatment, error } = await supabase
      .from("treatments")
      .update(update as never)
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw error;
    return treatment;
  });


export const deleteTreatment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("treatments").delete().eq("id", data.id);
    if (error) throw error;
    return { success: true };
  });

export const getTreatmentsBySlug = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => input)
  .handler(async ({ data }) => {
    const supabase = getServerSupabasePublic();
    const { data: profile, error: pErr } = await supabase
      .rpc("get_public_profile_by_slug", { p_slug: data.slug.toLowerCase() })
      .single();
    if (pErr) throw pErr;
    const { data: treatments, error } = await supabase
      .from("treatments")
      .select("*")
      .eq("profile_id", profile.id)
      .eq("active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });
    if (error) throw error;
    return treatments;
  });

export const reorderTreatments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { ids: string[] }) => input)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: profile, error } = await supabase
      .from("profiles").select("id").eq("user_id", context.userId).single();
    if (error) throw error;
    await Promise.all(
      data.ids.map((id, idx) =>
        supabase
          .from("treatments")
          .update({ sort_order: idx })
          .eq("id", id)
          .eq("profile_id", profile.id),
      ),
    );
    return { success: true };
  });



export const bulkSetRebookReminders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      ids: string[];
      rebook_reminder_days?: number | null;
      topup_reminder_days?: number | null;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    if (data.ids.length === 0) return { success: true, updated: 0 };
    const { data: profile, error: pErr } = await supabase
      .from("profiles").select("id").eq("user_id", context.userId).single();
    if (pErr) throw pErr;
    const update: Record<string, unknown> = {};
    if (data.rebook_reminder_days !== undefined) update.rebook_reminder_days = data.rebook_reminder_days;
    if (data.topup_reminder_days !== undefined) update.topup_reminder_days = data.topup_reminder_days;
    if (Object.keys(update).length === 0) return { success: true, updated: 0 };
    const { error } = await supabase
      .from("treatments")
      .update(update as never)
      .in("id", data.ids)
      .eq("profile_id", profile.id);
    if (error) throw error;
    return { success: true, updated: data.ids.length };
  });

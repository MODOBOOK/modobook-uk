import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";

function getServerSupabasePublic() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    },
  );
}

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { resolveClinicAccess } = await import("./clinic-context.server");
    const access = await resolveClinicAccess(supabase, userId);
    if (!access.profileId) return null;
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", access.profileId)
      .single();
    if (error && error.code !== "PGRST116") throw error;
    if (!data) return null;
    return {
      ...data,
      __clinic_role: access.role,
      __is_owner: access.isOwner,
      __data_scope: access.dataScope,
    } as typeof data & {
      __clinic_role: string;
      __is_owner: boolean;
      __data_scope: string;
    };
  });

export const createProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      full_name: string;
      clinic_name: string;
      slug: string;
      tagline?: string;
      about?: string;
      bio?: string;
      welcome_intro_html?: string;
      about_page?: Record<string, unknown>;
      phone?: string;
      email?: string;
      address?: Record<string, string>;
      brand_color?: string;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const slug = data.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const { data: profile, error } = await supabase
      .from("profiles")
      .insert({
        user_id: userId,
        full_name: data.full_name,
        clinic_name: data.clinic_name,
        slug,
        tagline: data.tagline,
        about: data.about,
        bio: data.bio,
        welcome_intro_html: data.welcome_intro_html,
        about_page: (data.about_page ?? {}) as Json,
        phone: data.phone,
        email: data.email ?? (context.claims.email as string | undefined),
        address: data.address,
        brand_color: data.brand_color,
        active: true,
      })
      .select()
      .single();
    if (error) throw error;
    return profile;
  });

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id: string;
      full_name?: string;
      clinic_name?: string;
      slug?: string;
      tagline?: string;
      about?: string;
      bio?: string;
      phone?: string;
      email?: string;
      address?: Record<string, string>;
      hero_url?: string;
      brand_color?: string;
      social_links?: Record<string, string>;
      active?: boolean;
      welcome_intro_html?: string;
      deposit_amount_cents?: number;
      deposit_type?: "fixed" | "percent";
      deposit_percent?: number;
      deposit_policy_text?: string;
      cancellation_rules?: { hours_before: number; fee_percent: number }[];
      chooser_enabled?: boolean;
      chooser_show_know?: boolean;
      chooser_show_unsure?: boolean;
      chooser_show_consultation?: boolean;
      chooser_consultation_treatment_id?: string | null;
      chooser_intro_text?: string | null;
      chooser_consultation_treatment_ids?: string[];
      chooser_extra_enabled?: boolean;
      chooser_extra_title?: string | null;
      chooser_extra_body?: string | null;
      chooser_extra_treatment_ids?: string[];
      model_slots_position?: "top" | "bottom";
      terms_html?: string | null;
      terms_required?: boolean;
      contact_sms_number?: string | null;
      contact_whatsapp_number?: string | null;
      practitioner_selection_mode?: "required" | "optional" | "first_available";
      favourite_treatment_ids?: string[];
      favourites_enabled?: boolean;
      favourites_custom_title?: string | null;
      about_page?: Record<string, unknown>;
      // Booking window settings
      booking_min_notice_hours?: number;
      booking_max_lead_days?: number;
      booking_buffer_before_minutes?: number;
      booking_buffer_after_minutes?: number;
      booking_daily_cap?: number | null;
      booking_smart_times_enabled?: boolean;
      // Payment settings
      payment_pass_fees_to_customer?: boolean;
      payment_surcharge_card_enabled?: boolean;
      payment_surcharge_card_percent?: number;
      payment_surcharge_bnpl_enabled?: boolean;
      payment_surcharge_bnpl_percent?: number;
      payment_surcharge_deposit_enabled?: boolean;
      payment_surcharge_deposit_percent?: number;
      stripe_fee_pass_to_patient?: boolean;
      stripe_fee_bnpl_pass_to_patient?: boolean;
      stripe_fee_card_percent?: number;
      stripe_fee_card_fixed_cents?: number;
      stripe_fee_bnpl_percent?: number;
      stripe_fee_bnpl_fixed_cents?: number;
      payment_klarna_enabled?: boolean;
      payment_clearpay_enabled?: boolean;
      payment_card_full_enabled?: boolean;
      payment_deposit_enabled?: boolean;
      require_deposit_to_confirm?: boolean;
      allow_pay_in_clinic?: boolean;
      cash_only_balance?: boolean;
      save_card_on_file?: boolean;
      payment_card_capture_enabled?: boolean;
      card_capture_policy_text?: string | null;
      show_prices_on_booking?: boolean;
      enforce_cancellation_fee?: boolean;
      // Patient rules
      require_account_to_book?: boolean;
      require_phone?: boolean;
      require_dob?: boolean;
      require_address?: boolean;
      require_medical_forms_before_appt?: boolean;
      allow_patient_reschedule?: boolean;
      allow_patient_cancel?: boolean;
      patient_reschedule_max?: number | null;
      patient_reschedule_cutoff_hours?: number | null;
      patient_cancel_cutoff_hours?: number | null;
      late_cancel_mode?: "block" | "warn_agree";
      auto_refund_on_cancel?: boolean;
      no_refund_policy_enabled?: boolean;
      no_refund_policy_text?: string | null;
      // Confirmations & reminders
      auto_confirm_bookings?: boolean;
      email_confirmations_enabled?: boolean;
      notify_new_booking_email?: boolean;
      new_booking_email_to?: string | null;
      sms_reminders_enabled?: boolean;
      whatsapp_reminders_enabled?: boolean;
      whatsapp_notify_confirmation?: boolean;
      whatsapp_notify_reminder?: boolean;
      whatsapp_notify_cancellation?: boolean;
      whatsapp_notify_rebook?: boolean;
      sms_templates?: Record<string, string>;
      sms_channels?: Record<string, string>;
      sms_timings?: Record<string, unknown> | object;

      reminder_hours_before?: number[];
      // Invoice branding
      invoice_bank_name?: string | null;
      invoice_account_name?: string | null;
      invoice_sort_code?: string | null;
      invoice_account_number?: string | null;
      invoice_iban?: string | null;
      invoice_swift?: string | null;
      invoice_payment_reference?: string | null;
      invoice_footer_notes?: string | null;
      invoice_vat_number?: string | null;
      invoice_company_number?: string | null;
      invoice_show_bank_details?: boolean;
      invoice_show_logo?: boolean;
      display_name_mode?: "clinic" | "practitioner" | "both";
      specialties?: string[];
      qualifications?: { label: string; year?: string }[];
      timeline?: { year: string; label: string }[];
      avatar_url?: string | null;
      membership_hero_title?: string | null;
      membership_hero_subtitle?: string | null;
    }) => input,
  )



  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const update: Record<string, unknown> = {};
    if (data.full_name !== undefined) update.full_name = data.full_name;
    if (data.clinic_name !== undefined) update.clinic_name = data.clinic_name;
    if (data.slug !== undefined) update.slug = data.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    if (data.tagline !== undefined) update.tagline = data.tagline;
    if (data.about !== undefined) update.about = data.about;
    if (data.bio !== undefined) update.bio = data.bio;
    if (data.phone !== undefined) update.phone = data.phone;
    if (data.email !== undefined) update.email = data.email;
    if (data.address !== undefined) update.address = data.address as Json;
    if (data.hero_url !== undefined) update.hero_url = data.hero_url;
    if (data.brand_color !== undefined) update.brand_color = data.brand_color;
    if (data.social_links !== undefined) update.social_links = data.social_links as Json;
    if (data.active !== undefined) update.active = data.active;
    if (data.welcome_intro_html !== undefined) update.welcome_intro_html = data.welcome_intro_html;
    if (data.deposit_amount_cents !== undefined) update.deposit_amount_cents = data.deposit_amount_cents;
    if (data.deposit_type !== undefined) update.deposit_type = data.deposit_type;
    if (data.deposit_percent !== undefined) update.deposit_percent = data.deposit_percent;
    if (data.deposit_policy_text !== undefined) update.deposit_policy_text = data.deposit_policy_text;
    if (data.cancellation_rules !== undefined) update.cancellation_rules = data.cancellation_rules as Json;
    if (data.chooser_enabled !== undefined) update.chooser_enabled = data.chooser_enabled;
    if (data.chooser_show_know !== undefined) update.chooser_show_know = data.chooser_show_know;
    if (data.chooser_show_unsure !== undefined) update.chooser_show_unsure = data.chooser_show_unsure;
    if (data.chooser_show_consultation !== undefined) update.chooser_show_consultation = data.chooser_show_consultation;
    if (data.chooser_consultation_treatment_id !== undefined) update.chooser_consultation_treatment_id = data.chooser_consultation_treatment_id;
    if (data.chooser_intro_text !== undefined) update.chooser_intro_text = data.chooser_intro_text;
    if (data.chooser_consultation_treatment_ids !== undefined) update.chooser_consultation_treatment_ids = data.chooser_consultation_treatment_ids;
    if (data.chooser_extra_enabled !== undefined) update.chooser_extra_enabled = data.chooser_extra_enabled;
    if (data.chooser_extra_title !== undefined) update.chooser_extra_title = data.chooser_extra_title;
    if (data.chooser_extra_body !== undefined) update.chooser_extra_body = data.chooser_extra_body;
    if (data.chooser_extra_treatment_ids !== undefined) update.chooser_extra_treatment_ids = data.chooser_extra_treatment_ids;

    // Only the singular chooser_consultation_treatment_id has a FK constraint.
    // Validate it against the treatments table to avoid FK violation; the array
    // columns have no FK, so we leave them untouched (avoids accidentally wiping
    // the array if the RLS-scoped lookup returns no rows).
    if (data.chooser_consultation_treatment_id) {
      const { data: existing } = await supabase
        .from("treatments")
        .select("id")
        .eq("id", data.chooser_consultation_treatment_id)
        .maybeSingle();
      if (!existing) update.chooser_consultation_treatment_id = null;
    }

    if (data.model_slots_position !== undefined) update.model_slots_position = data.model_slots_position;
    if (data.terms_html !== undefined) update.terms_html = data.terms_html;
    if (data.terms_required !== undefined) update.terms_required = data.terms_required;
    if (data.contact_sms_number !== undefined) update.contact_sms_number = data.contact_sms_number;
    if (data.contact_whatsapp_number !== undefined) update.contact_whatsapp_number = data.contact_whatsapp_number;
    if (data.practitioner_selection_mode !== undefined) update.practitioner_selection_mode = data.practitioner_selection_mode;
    if (data.favourite_treatment_ids !== undefined) update.favourite_treatment_ids = data.favourite_treatment_ids;
    if (data.favourites_enabled !== undefined) update.favourites_enabled = data.favourites_enabled;
    if (data.favourites_custom_title !== undefined) update.favourites_custom_title = data.favourites_custom_title;
    if (data.about_page !== undefined) update.about_page = data.about_page as Json;
    if (data.specialties !== undefined) update.specialties = data.specialties;
    if (data.qualifications !== undefined) update.qualifications = data.qualifications as Json;
    if (data.timeline !== undefined) update.timeline = data.timeline as Json;
    if (data.avatar_url !== undefined) update.avatar_url = data.avatar_url;
    if (data.membership_hero_title !== undefined) update.membership_hero_title = data.membership_hero_title;
    if (data.membership_hero_subtitle !== undefined) update.membership_hero_subtitle = data.membership_hero_subtitle;

    const passthroughKeys = [
      "booking_min_notice_hours","booking_max_lead_days","booking_buffer_before_minutes",
      "booking_buffer_after_minutes","booking_daily_cap","booking_smart_times_enabled",
      "payment_pass_fees_to_customer","payment_klarna_enabled","payment_clearpay_enabled",
      "payment_surcharge_card_enabled","payment_surcharge_card_percent",
      "payment_surcharge_bnpl_enabled","payment_surcharge_bnpl_percent",
      "payment_surcharge_deposit_enabled","payment_surcharge_deposit_percent",
      "stripe_fee_pass_to_patient","stripe_fee_bnpl_pass_to_patient","stripe_fee_card_percent","stripe_fee_card_fixed_cents",
      "stripe_fee_bnpl_percent","stripe_fee_bnpl_fixed_cents",
      "payment_card_full_enabled","payment_deposit_enabled","require_deposit_to_confirm",
      "allow_pay_in_clinic","cash_only_balance","save_card_on_file","show_prices_on_booking","enforce_cancellation_fee",
      "payment_card_capture_enabled","card_capture_policy_text",
      "require_account_to_book","require_phone","require_dob","require_address",
      "require_medical_forms_before_appt","allow_patient_reschedule","allow_patient_cancel",
      "patient_reschedule_max","patient_reschedule_cutoff_hours","patient_cancel_cutoff_hours","late_cancel_mode",
      "auto_refund_on_cancel","no_refund_policy_enabled","no_refund_policy_text",
      "auto_confirm_bookings","email_confirmations_enabled","sms_reminders_enabled",
      "notify_new_booking_email","new_booking_email_to",
      "whatsapp_reminders_enabled","whatsapp_notify_confirmation","whatsapp_notify_reminder",
      "whatsapp_notify_cancellation","whatsapp_notify_rebook","reminder_hours_before",
      "sms_templates","sms_channels","sms_timings",
      "invoice_bank_name","invoice_account_name","invoice_sort_code",
      "invoice_account_number","invoice_iban","invoice_swift",
      "invoice_payment_reference","invoice_footer_notes","invoice_vat_number",
      "invoice_company_number","invoice_show_bank_details","invoice_show_logo",
      "display_name_mode",
    ] as const;

    for (const k of passthroughKeys) {
      const v = (data as Record<string, unknown>)[k];
      if (v !== undefined) update[k] = v;
    }








    const { data: profile, error } = await supabase
      .from("profiles")
      .update(update as Database["public"]["Tables"]["profiles"]["Update"])
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw error;
    return profile;
  });

export const getProfileBySlug = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => input)
  .handler(async ({ data }) => {
    const supabase = getServerSupabasePublic();
    const { data: profile, error } = await supabase
      .rpc("get_public_profile_by_slug", { p_slug: data.slug.toLowerCase() })
      .single();
    if (error) throw error;
    return profile;
  });

export const checkSlugAvailable = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string; excludeOwn?: string }) => input)
  .handler(async ({ data }) => {
    const supabase = getServerSupabasePublic();
    const { data: available, error } = await supabase.rpc("is_slug_available", {
      p_slug: data.slug.toLowerCase(),
      p_exclude_id: data.excludeOwn,
    });
    if (error) throw error;
    return { available: !!available };
  });

export const updateStripeConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { accountId: string; status?: string; chargesEnabled?: boolean }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: profile, error } = await supabase
      .from("profiles")
      .update({
        stripe_connect_account_id: data.accountId,
        stripe_connect_onboarding_status: data.status ?? "pending",
      })
      .eq("user_id", userId)
      .select()
      .single();
    if (error) throw error;
    return profile;
  });

DROP FUNCTION IF EXISTS public.get_public_profile_by_slug(text);

CREATE OR REPLACE FUNCTION public.get_public_profile_by_slug(p_slug text)
 RETURNS TABLE(id uuid, slug text, full_name text, clinic_name text, tagline text, about text, bio text, avatar_url text, hero_url text, brand_color text, address jsonb, social_links jsonb, specialties text[], qualifications jsonb, timeline jsonb, welcome_intro_html text, deposit_amount_cents integer, deposit_policy_text text, cancellation_rules jsonb, terms_html text, terms_required boolean, discount_stack_mode text, contact_sms_number text, contact_whatsapp_number text, chooser_enabled boolean, chooser_show_know boolean, chooser_show_unsure boolean, chooser_show_consultation boolean, chooser_consultation_treatment_id uuid, chooser_consultation_treatment_ids uuid[], chooser_intro_text text, chooser_extra_enabled boolean, chooser_extra_title text, chooser_extra_body text, chooser_extra_treatment_ids uuid[], model_slots_position text, practitioner_selection_mode text, favourite_treatment_ids uuid[], favourites_enabled boolean, favourites_custom_title text, booking_min_notice_hours integer, booking_max_lead_days integer, booking_buffer_before_minutes integer, booking_buffer_after_minutes integer, booking_daily_cap integer, booking_smart_times_enabled boolean, payment_pass_fees_to_customer boolean, payment_klarna_enabled boolean, payment_clearpay_enabled boolean, payment_card_full_enabled boolean, payment_deposit_enabled boolean, require_deposit_to_confirm boolean, allow_pay_in_clinic boolean, show_prices_on_booking boolean, enforce_cancellation_fee boolean, require_account_to_book boolean, require_phone boolean, require_dob boolean, require_address boolean, require_medical_forms_before_appt boolean, allow_patient_reschedule boolean, allow_patient_cancel boolean, auto_confirm_bookings boolean, email_confirmations_enabled boolean, sms_reminders_enabled boolean, whatsapp_reminders_enabled boolean, reminder_hours_before integer[], display_name_mode text, no_refund_policy_enabled boolean, no_refund_policy_text text, active boolean, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    id, slug, full_name, clinic_name, tagline, about, bio, avatar_url, hero_url,
    brand_color, address, social_links, specialties, qualifications, timeline,
    welcome_intro_html, deposit_amount_cents, deposit_policy_text, cancellation_rules,
    terms_html, terms_required, discount_stack_mode,
    contact_sms_number, contact_whatsapp_number,
    chooser_enabled, chooser_show_know, chooser_show_unsure,
    chooser_show_consultation, chooser_consultation_treatment_id,
    chooser_consultation_treatment_ids, chooser_intro_text,
    chooser_extra_enabled, chooser_extra_title, chooser_extra_body,
    chooser_extra_treatment_ids,
    model_slots_position,
    practitioner_selection_mode,
    favourite_treatment_ids, favourites_enabled, favourites_custom_title,
    booking_min_notice_hours, booking_max_lead_days,
    booking_buffer_before_minutes, booking_buffer_after_minutes,
    booking_daily_cap, booking_smart_times_enabled,
    payment_pass_fees_to_customer, payment_klarna_enabled, payment_clearpay_enabled,
    payment_card_full_enabled, payment_deposit_enabled, require_deposit_to_confirm,
    allow_pay_in_clinic, show_prices_on_booking, enforce_cancellation_fee,
    require_account_to_book, require_phone, require_dob, require_address,
    require_medical_forms_before_appt, allow_patient_reschedule, allow_patient_cancel,
    auto_confirm_bookings, email_confirmations_enabled, sms_reminders_enabled,
    whatsapp_reminders_enabled, reminder_hours_before,
    display_name_mode,
    no_refund_policy_enabled, no_refund_policy_text,
    active, created_at, updated_at
  FROM public.profiles
  WHERE slug = p_slug AND active = true;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_public_profile_by_slug(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_profile_by_slug(text) TO anon, authenticated, service_role;
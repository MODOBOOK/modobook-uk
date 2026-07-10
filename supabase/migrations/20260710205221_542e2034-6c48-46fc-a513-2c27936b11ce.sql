CREATE OR REPLACE FUNCTION public.get_patient_account_profile_by_slug(p_slug text)
RETURNS TABLE (
  id uuid,
  full_name text,
  clinic_name text,
  brand_color text,
  avatar_url text,
  allow_patient_cancel boolean,
  allow_patient_reschedule boolean,
  cancellation_rules jsonb,
  patient_cancel_cutoff_hours integer,
  patient_reschedule_cutoff_hours integer,
  patient_reschedule_max integer,
  late_cancel_mode text,
  email text,
  phone text,
  contact_sms_number text,
  contact_whatsapp_number text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.full_name,
    p.clinic_name,
    p.brand_color,
    p.avatar_url,
    p.allow_patient_cancel,
    p.allow_patient_reschedule,
    p.cancellation_rules,
    p.patient_cancel_cutoff_hours,
    p.patient_reschedule_cutoff_hours,
    p.patient_reschedule_max,
    p.late_cancel_mode::text,
    p.email,
    p.phone,
    p.contact_sms_number,
    p.contact_whatsapp_number
  FROM public.profiles p
  WHERE p.slug = p_slug
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_patient_account_profile_by_slug(text) TO anon, authenticated;
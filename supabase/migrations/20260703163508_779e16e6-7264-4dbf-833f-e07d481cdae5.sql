DROP FUNCTION IF EXISTS public.get_medical_form_by_token(text);

CREATE OR REPLACE FUNCTION public.get_medical_form_by_token(p_token text)
 RETURNS TABLE(form_id uuid, status text, template_name text, template_schema jsonb, patient_name text, scheduled_date date, start_time time without time zone, treatment_name text, clinic_name text, brand_color text, response jsonb, slug text, client_contact jsonb)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    amf.id,
    amf.status,
    mft.name,
    mft.schema,
    COALESCE(a.patient_name, cc.full_name, amf.recipient_email)::text,
    a.scheduled_date,
    a.start_time,
    COALESCE(t.name, 'Medical Form')::text,
    p.clinic_name,
    p.brand_color,
    amf.response,
    p.slug,
    CASE WHEN cc.id IS NULL THEN NULL ELSE jsonb_build_object(
      'full_name', cc.full_name,
      'email', cc.email,
      'phone', cc.phone,
      'dob', cc.dob,
      'gender', cc.gender,
      'address_line1', cc.address_line1,
      'address_line2', cc.address_line2,
      'city', cc.city,
      'county', cc.county,
      'postcode', cc.postcode,
      'country', cc.country,
      'address', cc.address,
      'emergency_contact_name', cc.emergency_contact_name,
      'emergency_contact_phone', cc.emergency_contact_phone,
      'gp_name', cc.gp_name,
      'gp_address', cc.gp_address
    ) END
  FROM public.appointment_medical_forms amf
  JOIN public.medical_form_templates mft ON mft.id = amf.template_id
  LEFT JOIN public.appointments a ON a.id = amf.appointment_id
  LEFT JOIN public.treatments t ON t.id = a.treatment_id
  LEFT JOIN public.clinic_clients cc ON cc.id = amf.client_id
  JOIN public.profiles p ON p.id = amf.profile_id
  WHERE amf.token = p_token
  LIMIT 1;
$function$;
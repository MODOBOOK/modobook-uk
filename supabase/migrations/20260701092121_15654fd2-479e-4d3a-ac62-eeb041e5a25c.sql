DROP FUNCTION IF EXISTS public.get_medical_form_by_token(text);
DROP FUNCTION IF EXISTS public.get_consent_by_token(text);

CREATE FUNCTION public.get_medical_form_by_token(p_token text)
 RETURNS TABLE(form_id uuid, status text, template_name text, template_schema jsonb, patient_name text, scheduled_date date, start_time time without time zone, treatment_name text, clinic_name text, brand_color text, response jsonb, slug text)
 LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT amf.id, amf.status, mft.name, mft.schema,
    COALESCE(a.patient_name, cc.full_name)::text,
    a.scheduled_date, a.start_time,
    COALESCE(t.name, 'Medical Form')::text,
    p.clinic_name, p.brand_color, amf.response, p.slug
  FROM public.appointment_medical_forms amf
  JOIN public.medical_form_templates mft ON mft.id = amf.template_id
  LEFT JOIN public.appointments a ON a.id = amf.appointment_id
  LEFT JOIN public.treatments t ON t.id = a.treatment_id
  LEFT JOIN public.clinic_clients cc ON cc.id = amf.client_id
  JOIN public.profiles p ON p.id = amf.profile_id
  WHERE amf.token = p_token
$$;

CREATE FUNCTION public.get_consent_by_token(p_token text)
 RETURNS TABLE(consent_id uuid, appointment_id uuid, status text, template_name text, template_body text, template_sections jsonb, template_summary text, requires_signature boolean, patient_name text, scheduled_date date, start_time time without time zone, treatment_name text, clinic_name text, slug text)
 LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT ac.id, ac.appointment_id, ac.status,
    ct.name, ct.body_markdown, ct.sections, ct.summary, ct.requires_signature,
    a.patient_name, a.scheduled_date, a.start_time,
    t.name, p.clinic_name, p.slug
  FROM public.appointment_consents ac
  JOIN public.consent_templates ct ON ct.id = ac.consent_template_id
  JOIN public.appointments a ON a.id = ac.appointment_id
  JOIN public.treatments t ON t.id = a.treatment_id
  JOIN public.profiles p ON p.id = ac.profile_id
  WHERE ac.token = p_token
$$;
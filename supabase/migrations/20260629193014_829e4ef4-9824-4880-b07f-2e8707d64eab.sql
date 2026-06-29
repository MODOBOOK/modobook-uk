
DROP FUNCTION IF EXISTS public.get_consent_by_token(text);
CREATE OR REPLACE FUNCTION public.get_consent_by_token(p_token text)
 RETURNS TABLE(consent_id uuid, appointment_id uuid, status text, template_name text, template_body text, template_sections jsonb, template_summary text, requires_signature boolean, patient_name text, scheduled_date date, start_time time without time zone, treatment_name text, clinic_name text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    ac.id, ac.appointment_id, ac.status,
    ct.name, ct.body_markdown, ct.sections, ct.summary, ct.requires_signature,
    a.patient_name, a.scheduled_date, a.start_time,
    t.name, p.clinic_name
  from public.appointment_consents ac
  join public.consent_templates ct on ct.id = ac.consent_template_id
  join public.appointments a on a.id = ac.appointment_id
  join public.treatments t on t.id = a.treatment_id
  join public.profiles p on p.id = ac.profile_id
  where ac.token = p_token
$function$;

CREATE OR REPLACE FUNCTION public.get_appointment_by_manage_token(p_token text)
 RETURNS TABLE(id uuid, scheduled_date date, start_time time without time zone, end_time time without time zone, patient_name text, patient_email text, patient_phone text, status text, treatment_name text, location_name text, clinic_name text, slug text, cancellation_rules jsonb, deposit_policy_text text, aftercare_html text, has_allergies boolean)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT a.id, a.scheduled_date, a.start_time, a.end_time,
         a.patient_name, a.patient_email, a.patient_phone, a.status,
         COALESCE(t.name, (
           SELECT string_agg(t2.name, ', ' ORDER BY ae.created_at)
           FROM public.appointment_extras ae
           JOIN public.treatments t2 ON t2.id = ae.treatment_id
           WHERE ae.appointment_id = a.id
         ), 'Your appointment'),
         l.name, p.clinic_name, p.slug,
         p.cancellation_rules, p.deposit_policy_text,
         a.aftercare_html, a.has_allergies
  FROM public.appointments a
  JOIN public.profiles p ON p.id = a.profile_id
  LEFT JOIN public.treatments t ON t.id = a.treatment_id
  LEFT JOIN public.locations l ON l.id = a.location_id
  WHERE a.manage_token = p_token
$function$;
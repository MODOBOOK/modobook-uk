ALTER TABLE public.discount_codes ADD COLUMN IF NOT EXISTS appointment_starts_on date, ADD COLUMN IF NOT EXISTS appointment_ends_on date;

CREATE OR REPLACE FUNCTION public.validate_discount_code(p_slug text, p_code text, p_treatment_ids uuid[], p_appointment_date date)
 RETURNS TABLE(id uuid, code text, label text, kind text, amount numeric, applies_to_treatment_ids uuid[])
 LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_pid uuid; v_now timestamptz := now(); v_dow integer := EXTRACT(DOW FROM now())::int;
BEGIN
  SELECT p.id INTO v_pid FROM public.profiles p WHERE p.slug = p_slug AND p.active = true;
  IF v_pid IS NULL THEN RETURN; END IF;
  RETURN QUERY
    SELECT dc.id, dc.code, dc.label, dc.kind, dc.amount,
      CASE WHEN coalesce(array_length(dc.treatment_ids,1),0) = 0
        THEN p_treatment_ids
        ELSE ARRAY(SELECT unnest(p_treatment_ids) INTERSECT SELECT unnest(dc.treatment_ids))
      END
    FROM public.discount_codes dc
    WHERE dc.profile_id = v_pid
      AND dc.active = true
      AND lower(dc.code) = lower(p_code)
      AND (dc.starts_at IS NULL OR dc.starts_at <= v_now)
      AND (dc.ends_at IS NULL OR dc.ends_at >= v_now)
      AND (dc.max_uses IS NULL OR dc.uses_count < dc.max_uses)
      AND (dc.days_of_week IS NULL OR coalesce(array_length(dc.days_of_week,1),0) = 0 OR v_dow = ANY(dc.days_of_week))
      AND (dc.appointment_starts_on IS NULL OR (p_appointment_date IS NOT NULL AND p_appointment_date >= dc.appointment_starts_on))
      AND (dc.appointment_ends_on IS NULL OR (p_appointment_date IS NOT NULL AND p_appointment_date <= dc.appointment_ends_on));
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_discount_code(p_slug text, p_code text, p_treatment_ids uuid[])
 RETURNS TABLE(id uuid, code text, label text, kind text, amount numeric, applies_to_treatment_ids uuid[])
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT * FROM public.validate_discount_code(p_slug, p_code, p_treatment_ids, NULL::date);
$function$;

GRANT EXECUTE ON FUNCTION public.validate_discount_code(text, text, uuid[], date) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.discount_code_appointment_window(p_slug text, p_code text)
 RETURNS TABLE(appointment_starts_on date, appointment_ends_on date)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT dc.appointment_starts_on, dc.appointment_ends_on
  FROM public.discount_codes dc JOIN public.profiles p ON p.id = dc.profile_id
  WHERE p.slug = p_slug AND p.active = true AND dc.active = true AND lower(dc.code) = lower(p_code)
    AND (dc.appointment_starts_on IS NOT NULL OR dc.appointment_ends_on IS NOT NULL)
  LIMIT 1;
$function$;
GRANT EXECUTE ON FUNCTION public.discount_code_appointment_window(text, text) TO anon, authenticated, service_role;
CREATE OR REPLACE FUNCTION public.get_plan_by_token(_token uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'plan', to_jsonb(p.*),
    'clinic', jsonb_build_object(
      'clinic_name', pr.clinic_name,
      'slug', pr.slug,
      'logo_url', pr.avatar_url,
      'brand_color', pr.brand_color
    ),
    'client', jsonb_build_object('full_name', cc.full_name, 'email', cc.email),
    'sessions', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', s.id,
        'session_number', s.session_number,
        'interval_weeks_from_previous', s.interval_weeks_from_previous,
        'suggested_date', s.suggested_date,
        'status', s.status,
        'notes', s.notes,
        'price_cents_override', s.price_cents_override,
        'expected_results', s.expected_results,
        'downtime', s.downtime,
        'session_purpose', s.session_purpose,
        'treatment', CASE WHEN t.id IS NOT NULL THEN jsonb_build_object('id', t.id, 'name', t.name, 'price', t.price, 'duration', t.duration) ELSE NULL END
      ) ORDER BY s.session_number)
      FROM public.treatment_plan_sessions s
      LEFT JOIN public.treatments t ON t.id = s.treatment_id
      WHERE s.plan_id = p.id
    ), '[]'::jsonb)
  ) INTO result
  FROM public.treatment_plans p
  LEFT JOIN public.profiles pr ON pr.id = p.profile_id
  LEFT JOIN public.clinic_clients cc ON cc.id = p.client_id
  WHERE p.patient_token = _token
    AND p.status IN ('sent','accepted','in_progress','declined','completed');
  RETURN result;
END;
$function$;
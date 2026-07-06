
-- Extend treatment plan sessions with AI-editable per-session guidance
ALTER TABLE public.treatment_plan_sessions
  ADD COLUMN IF NOT EXISTS expected_results text,
  ADD COLUMN IF NOT EXISTS downtime text,
  ADD COLUMN IF NOT EXISTS session_purpose text;

-- Extend treatment plans with a public review token and decline metadata
ALTER TABLE public.treatment_plans
  ADD COLUMN IF NOT EXISTS patient_token uuid UNIQUE DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS declined_at timestamptz,
  ADD COLUMN IF NOT EXISTS decline_reason text,
  ADD COLUMN IF NOT EXISTS decline_tags text[];

UPDATE public.treatment_plans SET patient_token = gen_random_uuid() WHERE patient_token IS NULL;

-- Security definer RPCs for public tokenised access (no auth required)
CREATE OR REPLACE FUNCTION public.get_plan_by_token(_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'plan', to_jsonb(p.*),
    'clinic', jsonb_build_object(
      'clinic_name', pr.clinic_name,
      'slug', pr.slug,
      'logo_url', pr.logo_url,
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
$$;

GRANT EXECUTE ON FUNCTION public.get_plan_by_token(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.respond_to_plan_by_token(
  _token uuid,
  _accept boolean,
  _reason text DEFAULT NULL,
  _tags text[] DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan public.treatment_plans%ROWTYPE;
BEGIN
  SELECT * INTO v_plan FROM public.treatment_plans WHERE patient_token = _token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  IF v_plan.status NOT IN ('sent','declined') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_actionable', 'status', v_plan.status);
  END IF;
  IF _accept THEN
    UPDATE public.treatment_plans
      SET status = 'accepted', accepted_at = now(), declined_at = NULL, decline_reason = NULL, decline_tags = NULL
      WHERE id = v_plan.id;
  ELSE
    UPDATE public.treatment_plans
      SET status = 'declined', declined_at = now(), decline_reason = _reason, decline_tags = _tags
      WHERE id = v_plan.id;
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.respond_to_plan_by_token(uuid, boolean, text, text[]) TO anon, authenticated;

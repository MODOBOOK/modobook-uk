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
  v_slug text;
  v_client_name text;
  v_tags_text text;
BEGIN
  SELECT * INTO v_plan FROM public.treatment_plans WHERE patient_token = _token;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  IF v_plan.status NOT IN ('sent','declined') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_actionable', 'status', v_plan.status);
  END IF;

  SELECT slug INTO v_slug FROM public.profiles WHERE id = v_plan.profile_id;
  SELECT full_name INTO v_client_name FROM public.clinic_clients WHERE id = v_plan.client_id;

  IF _accept THEN
    UPDATE public.treatment_plans
      SET status = 'accepted', accepted_at = now(), declined_at = NULL, decline_reason = NULL, decline_tags = NULL
      WHERE id = v_plan.id;

    PERFORM public.create_notification(
      v_plan.profile_id,
      'plan',
      'Treatment plan accepted',
      COALESCE(v_client_name, 'A patient') || ' accepted "' || v_plan.name || '"',
      'â',
      '/dashboard/treatment-plans/' || v_plan.id::text,
      v_plan.id,
      'treatment_plan'
    );

    RETURN jsonb_build_object('ok', true, 'slug', v_slug);
  ELSE
    UPDATE public.treatment_plans
      SET status = 'declined', declined_at = now(), decline_reason = _reason, decline_tags = _tags
      WHERE id = v_plan.id;

    v_tags_text := CASE WHEN _tags IS NOT NULL AND array_length(_tags, 1) > 0
      THEN ' (' || array_to_string(_tags, ', ') || ')' ELSE '' END;

    PERFORM public.create_notification(
      v_plan.profile_id,
      'plan',
      'Treatment plan declined',
      COALESCE(v_client_name, 'A patient') || ' declined "' || v_plan.name || '"' || v_tags_text
        || CASE WHEN _reason IS NOT NULL AND length(trim(_reason)) > 0
             THEN ': ' || _reason ELSE '' END,
      'â ï¸',
      '/dashboard/treatment-plans/' || v_plan.id::text,
      v_plan.id,
      'treatment_plan'
    );

    RETURN jsonb_build_object('ok', true, 'slug', v_slug);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.respond_to_plan_by_token(uuid, boolean, text, text[]) TO anon, authenticated;
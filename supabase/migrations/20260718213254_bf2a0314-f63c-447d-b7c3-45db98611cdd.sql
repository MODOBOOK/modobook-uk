-- Grace-period platform-access logic + status helper

CREATE OR REPLACE FUNCTION public.practitioner_has_platform_access(_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT COALESCE(
    (
      SELECT
        CASE
          WHEN ps.suspended_at IS NOT NULL THEN false
          WHEN ps.comped THEN true
          WHEN ps.status IN ('active','trialing') THEN true
          WHEN ps.trial_end IS NOT NULL AND ps.trial_end + interval '7 days' > now() THEN true
          WHEN ps.status IN ('past_due','unpaid','canceled','incomplete','incomplete_expired')
               AND ps.current_period_end IS NOT NULL
               AND ps.current_period_end + interval '7 days' > now() THEN true
          ELSE false
        END
      FROM public.practitioner_subscriptions ps
      WHERE ps.profile_id = _profile_id
      LIMIT 1
    ),
    (
      SELECT (p.created_at + interval '30 days') > now()
      FROM public.profiles p
      WHERE p.id = _profile_id
    ),
    false
  )
$function$;

CREATE OR REPLACE FUNCTION public.practitioner_billing_status(_profile_id uuid)
RETURNS TABLE(state text, has_access boolean, days_left integer, deadline timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  ps public.practitioner_subscriptions%ROWTYPE;
  p_created timestamptz;
  grace_end timestamptz;
BEGIN
  SELECT * INTO ps FROM public.practitioner_subscriptions WHERE profile_id = _profile_id LIMIT 1;

  IF ps.id IS NULL THEN
    SELECT created_at INTO p_created FROM public.profiles WHERE id = _profile_id;
    IF p_created IS NULL THEN
      RETURN QUERY SELECT 'blocked'::text, false, 0, NULL::timestamptz;
      RETURN;
    END IF;
    grace_end := p_created + interval '30 days';
    IF grace_end > now() THEN
      RETURN QUERY SELECT 'welcome'::text, true,
        GREATEST(0, EXTRACT(DAY FROM (grace_end - now()))::int), grace_end;
    ELSE
      RETURN QUERY SELECT 'blocked'::text, false, 0, grace_end;
    END IF;
    RETURN;
  END IF;

  IF ps.suspended_at IS NOT NULL THEN
    RETURN QUERY SELECT 'suspended'::text, false, 0, ps.suspended_at;
    RETURN;
  END IF;

  IF ps.comped THEN
    RETURN QUERY SELECT 'comped'::text, true, NULL::int, NULL::timestamptz;
    RETURN;
  END IF;

  IF ps.status = 'active' THEN
    RETURN QUERY SELECT 'active'::text, true,
      CASE WHEN ps.current_period_end IS NOT NULL
           THEN GREATEST(0, EXTRACT(DAY FROM (ps.current_period_end - now()))::int)
           ELSE NULL END,
      ps.current_period_end;
    RETURN;
  END IF;

  IF ps.status = 'trialing' OR (ps.trial_end IS NOT NULL AND ps.trial_end > now()) THEN
    RETURN QUERY SELECT 'trial'::text, true,
      GREATEST(0, EXTRACT(DAY FROM (ps.trial_end - now()))::int), ps.trial_end;
    RETURN;
  END IF;

  IF ps.trial_end IS NOT NULL AND ps.trial_end + interval '7 days' > now() THEN
    grace_end := ps.trial_end + interval '7 days';
    RETURN QUERY SELECT 'grace'::text, true,
      GREATEST(0, EXTRACT(DAY FROM (grace_end - now()))::int), grace_end;
    RETURN;
  END IF;

  IF ps.status IN ('past_due','unpaid','canceled','incomplete','incomplete_expired')
     AND ps.current_period_end IS NOT NULL
     AND ps.current_period_end + interval '7 days' > now() THEN
    grace_end := ps.current_period_end + interval '7 days';
    RETURN QUERY SELECT 'grace'::text, true,
      GREATEST(0, EXTRACT(DAY FROM (grace_end - now()))::int), grace_end;
    RETURN;
  END IF;

  RETURN QUERY SELECT 'blocked'::text, false, 0, NULL::timestamptz;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.practitioner_billing_status(uuid) TO authenticated, service_role;

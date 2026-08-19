CREATE OR REPLACE FUNCTION public.practitioner_billing_status(_profile_id uuid)
 RETURNS TABLE(state text, has_access boolean, days_left integer, deadline timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
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

  -- Trial only counts while the trial end is genuinely in the future. A stale
  -- 'trialing' status with an expired trial_end must not keep access open.
  IF ps.trial_end IS NOT NULL AND ps.trial_end > now() THEN
    RETURN QUERY SELECT 'trial'::text, true,
      GREATEST(0, EXTRACT(DAY FROM (ps.trial_end - now()))::int), ps.trial_end;
    RETURN;
  END IF;

  IF ps.status = 'trialing' AND ps.trial_end IS NULL THEN
    RETURN QUERY SELECT 'trial'::text, true, NULL::int, NULL::timestamptz;
    RETURN;
  END IF;

  -- An expired trial locks immediately (no grace) -- the practitioner has
  -- never paid, so only the billing page stays reachable.
  IF ps.trial_end IS NOT NULL AND ps.trial_end <= now() THEN
    RETURN QUERY SELECT 'blocked'::text, false, 0, ps.trial_end;
    RETURN;
  END IF;

  -- Existing paying subscriptions keep a 7 day grace window on payment failure.
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
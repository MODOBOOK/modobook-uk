
CREATE TABLE IF NOT EXISTS public.health_fix_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_key text NOT NULL,
  action text NOT NULL,
  affected_count integer NOT NULL DEFAULT 0,
  sample jsonb,
  succeeded boolean NOT NULL DEFAULT true,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.health_fix_log TO authenticated;
GRANT ALL ON public.health_fix_log TO service_role;
ALTER TABLE public.health_fix_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can view health fix log" ON public.health_fix_log;
CREATE POLICY "Admins can view health fix log" ON public.health_fix_log
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX IF NOT EXISTS health_fix_log_created_idx ON public.health_fix_log (created_at DESC);

CREATE TABLE IF NOT EXISTS public.health_check_settings (
  id integer PRIMARY KEY DEFAULT 1,
  auto_fix_enabled boolean NOT NULL DEFAULT true,
  max_rows_per_fix integer NOT NULL DEFAULT 500,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT health_check_settings_singleton CHECK (id = 1)
);
INSERT INTO public.health_check_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
GRANT SELECT, UPDATE ON public.health_check_settings TO authenticated;
GRANT ALL ON public.health_check_settings TO service_role;
ALTER TABLE public.health_check_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can manage health check settings" ON public.health_check_settings;
CREATE POLICY "Admins can manage health check settings" ON public.health_check_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.health_findings
  ADD COLUMN IF NOT EXISTS auto_fixed_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_auto_fixed_at timestamptz;

CREATE OR REPLACE FUNCTION public.apply_health_auto_fixes()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_enabled boolean;
  v_cap integer;
  v_n integer;
  v_out jsonb := '[]'::jsonb;
BEGIN
  IF NOT pg_try_advisory_lock(hashtext('health_auto_fix')) THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'already running');
  END IF;

  SELECT auto_fix_enabled, max_rows_per_fix INTO v_enabled, v_cap
    FROM public.health_check_settings WHERE id = 1;
  IF NOT coalesce(v_enabled, false) THEN
    PERFORM pg_advisory_unlock(hashtext('health_auto_fix'));
    RETURN jsonb_build_object('skipped', true, 'reason', 'disabled');
  END IF;
  v_cap := greatest(1, least(coalesce(v_cap, 500), 5000));

  -- 1. Booking says paid but the money received is short: show it as still owing.
  BEGIN
    v_n := 0;
    WITH t AS (
      SELECT a.id FROM public.appointments a
       WHERE a.payment_status = 'paid'
         AND coalesce(a.total_amount, 0) > 0
         AND coalesce(a.amount_paid_cents, 0) < round(a.total_amount * 100)
       LIMIT v_cap
    )
    UPDATE public.appointments a SET payment_status = 'pending'
      FROM t WHERE a.id = t.id;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n > 0 THEN
      INSERT INTO public.health_fix_log (check_key, action, affected_count)
      VALUES ('payment_paid_but_short', 'Relabelled underpaid bookings as still owing', v_n);
    END IF;
    v_out := v_out || jsonb_build_array(jsonb_build_object('check_key','payment_paid_but_short','fixed',v_n));
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.health_fix_log (check_key, action, succeeded, error_message)
    VALUES ('payment_paid_but_short', 'Relabelled underpaid bookings as still owing', false, SQLERRM);
  END;

  -- 2. Booking fully covered but still labelled unpaid: mark it paid.
  BEGIN
    v_n := 0;
    WITH t AS (
      SELECT a.id FROM public.appointments a
       WHERE coalesce(a.payment_status, 'pending') NOT IN ('paid', 'refunded', 'cancelled')
         AND coalesce(a.total_amount, 0) > 0
         AND coalesce(a.amount_paid_cents, 0) >= round(a.total_amount * 100)
       LIMIT v_cap
    )
    UPDATE public.appointments a SET payment_status = 'paid'
      FROM t WHERE a.id = t.id;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n > 0 THEN
      INSERT INTO public.health_fix_log (check_key, action, affected_count)
      VALUES ('payment_covered_not_marked', 'Marked fully covered bookings as paid', v_n);
    END IF;
    v_out := v_out || jsonb_build_array(jsonb_build_object('check_key','payment_covered_not_marked','fixed',v_n));
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.health_fix_log (check_key, action, succeeded, error_message)
    VALUES ('payment_covered_not_marked', 'Marked fully covered bookings as paid', false, SQLERRM);
  END;

  -- 3. Money received but nothing in the ledger: add a reconciliation entry.
  BEGIN
    v_n := 0;
    WITH t AS (
      SELECT a.id, a.profile_id, a.amount_paid_cents
        FROM public.appointments a
       WHERE coalesce(a.amount_paid_cents, 0) > 0
         AND a.profile_id IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM public.payments p WHERE p.appointment_id = a.id)
       LIMIT v_cap
    )
    INSERT INTO public.payments (profile_id, appointment_id, amount, status, stripe_payment_intent_id)
    SELECT t.profile_id, t.id, round(t.amount_paid_cents::numeric / 100, 2), 'succeeded',
           'manual:reconciled:' || gen_random_uuid()::text
      FROM t;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n > 0 THEN
      INSERT INTO public.health_fix_log (check_key, action, affected_count)
      VALUES ('payment_missing_ledger', 'Added missing payment ledger entries', v_n);
    END IF;
    v_out := v_out || jsonb_build_array(jsonb_build_object('check_key','payment_missing_ledger','fixed',v_n));
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.health_fix_log (check_key, action, succeeded, error_message)
    VALUES ('payment_missing_ledger', 'Added missing payment ledger entries', false, SQLERRM);
  END;

  -- 4. Same card charge logged twice on one booking: keep the earliest copy only.
  BEGIN
    v_n := 0;
    WITH ranked AS (
      SELECT p.id, p.amount,
             row_number() OVER (PARTITION BY p.appointment_id, p.stripe_payment_intent_id ORDER BY p.created_at, p.id) AS rn,
             min(p.amount) OVER (PARTITION BY p.appointment_id, p.stripe_payment_intent_id) AS min_amount,
             max(p.amount) OVER (PARTITION BY p.appointment_id, p.stripe_payment_intent_id) AS max_amount
        FROM public.payments p
       WHERE p.appointment_id IS NOT NULL
         AND p.stripe_payment_intent_id LIKE 'pi\_%'
    ), dupes AS (
      SELECT id FROM ranked WHERE rn > 1 AND min_amount = max_amount LIMIT v_cap
    )
    DELETE FROM public.payments p USING dupes d WHERE p.id = d.id;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n > 0 THEN
      INSERT INTO public.health_fix_log (check_key, action, affected_count)
      VALUES ('payment_duplicate_ledger', 'Removed duplicate copies of the same card charge', v_n);
    END IF;
    v_out := v_out || jsonb_build_array(jsonb_build_object('check_key','payment_duplicate_ledger','fixed',v_n));
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.health_fix_log (check_key, action, succeeded, error_message)
    VALUES ('payment_duplicate_ledger', 'Removed duplicate copies of the same card charge', false, SQLERRM);
  END;

  PERFORM pg_advisory_unlock(hashtext('health_auto_fix'));
  RETURN jsonb_build_object('skipped', false, 'results', v_out);
EXCEPTION WHEN OTHERS THEN
  PERFORM pg_advisory_unlock(hashtext('health_auto_fix'));
  INSERT INTO public.health_fix_log (check_key, action, succeeded, error_message)
  VALUES ('_runner', 'Automatic fix run', false, SQLERRM);
  RETURN jsonb_build_object('skipped', true, 'reason', 'error');
END;
$fn$;

REVOKE ALL ON FUNCTION public.apply_health_auto_fixes() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_health_auto_fixes() TO service_role;

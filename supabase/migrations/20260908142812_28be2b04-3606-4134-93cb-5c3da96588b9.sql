CREATE OR REPLACE FUNCTION public.award_appointment_points()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
  v_clinic uuid;
  v_enabled boolean;
  v_rate numeric;
  v_amount numeric;
  v_points integer;
  v_awarded integer;
BEGIN
  IF COALESCE(NEW.is_demo, false) THEN
    RETURN NEW;
  END IF;

  -- Rewards are keyed by the clinic owner's account id, not the profile row id.
  SELECT user_id INTO v_clinic FROM public.profiles WHERE id = NEW.profile_id;
  IF v_clinic IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(earn_on_spend_enabled, false), COALESCE(points_per_pound_earn, 0)
    INTO v_enabled, v_rate
  FROM public.clinic_referral_settings
  WHERE clinic_profile_id = v_clinic;

  IF NOT COALESCE(v_enabled, false) OR COALESCE(v_rate, 0) <= 0 THEN
    RETURN NEW;
  END IF;

  v_user := NEW.patient_user_id;
  IF v_user IS NULL AND NEW.patient_email IS NOT NULL THEN
    SELECT user_id INTO v_user
    FROM public.patient_accounts
    WHERE profile_id = NEW.profile_id
      AND lower(email) = lower(NEW.patient_email)
    LIMIT 1;
  END IF;

  IF v_user IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(delta), 0) INTO v_awarded
  FROM public.patient_points_ledger
  WHERE ref_type = 'appointment' AND ref_id = NEW.id;

  IF NEW.status IN ('cancelled', 'no_show') THEN
    IF v_awarded > 0 THEN
      INSERT INTO public.patient_points_ledger
        (patient_user_id, clinic_profile_id, delta, reason, ref_type, ref_id, note)
      VALUES (v_user, v_clinic, -v_awarded, 'booking_reversed', 'appointment', NEW.id,
              'Points removed — appointment ' || NEW.status);
    END IF;
    RETURN NEW;
  END IF;

  v_amount := COALESCE(NEW.total_amount, 0);
  v_points := FLOOR(v_amount * v_rate)::int;
  IF v_points <= 0 THEN
    RETURN NEW;
  END IF;

  IF v_awarded < v_points THEN
    INSERT INTO public.patient_points_ledger
      (patient_user_id, clinic_profile_id, delta, reason, ref_type, ref_id, note)
    VALUES (v_user, v_clinic, v_points - v_awarded, 'booking_earned', 'appointment', NEW.id,
            'Points earned on booking');
  END IF;

  RETURN NEW;
END;
$$;

UPDATE public.patient_points_ledger l
SET clinic_profile_id = p.user_id
FROM public.profiles p
WHERE p.id = l.clinic_profile_id;
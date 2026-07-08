
-- Auto-payout trigger: when the referred appointment reaches
-- status='completed' AND payment_status='paid', insert credit + points
-- ledger entries and stamp rewarded_at. Idempotent via rewarded_at IS NULL.
CREATE OR REPLACE FUNCTION public.patient_referrals_auto_payout()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
BEGIN
  -- Only fire when transitioning into a paid+completed state
  IF NEW.status IS DISTINCT FROM 'completed' OR NEW.payment_status IS DISTINCT FROM 'paid' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE'
     AND OLD.status = 'completed'
     AND OLD.payment_status = 'paid' THEN
    -- No transition; nothing to do
    RETURN NEW;
  END IF;

  FOR r IN
    SELECT *
    FROM public.patient_referrals
    WHERE referred_appointment_id = NEW.id
      AND rewarded_at IS NULL
      AND status <> 'rejected'
  LOOP
    IF r.reward_credit_pennies > 0 THEN
      INSERT INTO public.patient_credit_ledger
        (patient_user_id, clinic_profile_id, delta_pennies, reason, referral_id)
      VALUES
        (r.referrer_user_id, r.clinic_profile_id, r.reward_credit_pennies,
         'referral_reward', r.id);
    END IF;
    IF r.reward_points > 0 THEN
      INSERT INTO public.patient_points_ledger
        (patient_user_id, clinic_profile_id, delta, reason, referral_id)
      VALUES
        (r.referrer_user_id, r.clinic_profile_id, r.reward_points,
         'referral_reward', r.id);
    END IF;
    UPDATE public.patient_referrals
       SET status = 'rewarded',
           rewarded_at = now()
     WHERE id = r.id;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_referrals_auto_payout ON public.appointments;
CREATE TRIGGER trg_referrals_auto_payout
AFTER INSERT OR UPDATE OF status, payment_status
ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.patient_referrals_auto_payout();

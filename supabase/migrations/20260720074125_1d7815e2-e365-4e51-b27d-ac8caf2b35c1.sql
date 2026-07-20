
-- Rewards tables need Data API grants; without them PostgREST returns permission errors even with RLS policies in place.
GRANT SELECT ON public.clinic_referral_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinic_referral_settings TO authenticated;
GRANT ALL ON public.clinic_referral_settings TO service_role;

GRANT SELECT ON public.clinic_reward_tiers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinic_reward_tiers TO authenticated;
GRANT ALL ON public.clinic_reward_tiers TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_referral_codes TO authenticated;
GRANT ALL ON public.patient_referral_codes TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_referrals TO authenticated;
GRANT ALL ON public.patient_referrals TO service_role;

GRANT SELECT ON public.patient_credit_ledger TO authenticated;
GRANT ALL ON public.patient_credit_ledger TO service_role;

GRANT SELECT ON public.patient_points_ledger TO authenticated;
GRANT ALL ON public.patient_points_ledger TO service_role;

-- Allow patients to insert their own referral row when linking a booking to a share code.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='patient_referrals'
      AND policyname='Patients create referral for own booking'
  ) THEN
    EXECUTE $p$CREATE POLICY "Patients create referral for own booking"
      ON public.patient_referrals
      FOR INSERT TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.appointments a
          WHERE a.id = patient_referrals.referred_appointment_id
            AND (a.patient_user_id = auth.uid() OR a.profile_id = auth.uid())
        )
      )$p$;
  END IF;
END $$;

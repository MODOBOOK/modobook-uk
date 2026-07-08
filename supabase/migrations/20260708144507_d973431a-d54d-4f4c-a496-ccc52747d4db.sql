
-- =========================================================
-- Patient referral program (MVP): codes, referrals, ledgers, settings
-- Scoped per clinic (profile_id = clinic owner user id, matching existing tables)
-- =========================================================

-- 1) Referral codes: one per (referrer patient user, clinic)
CREATE TABLE public.patient_referral_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_user_id UUID NOT NULL,
  clinic_profile_id UUID NOT NULL,
  code TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (patient_user_id, clinic_profile_id),
  UNIQUE (clinic_profile_id, code)
);
CREATE INDEX idx_prc_code ON public.patient_referral_codes(code);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_referral_codes TO authenticated;
GRANT SELECT ON public.patient_referral_codes TO anon; -- lookup by code on booking page
GRANT ALL ON public.patient_referral_codes TO service_role;

ALTER TABLE public.patient_referral_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients read own referral codes"
  ON public.patient_referral_codes FOR SELECT TO authenticated
  USING (auth.uid() = patient_user_id OR auth.uid() = clinic_profile_id);

CREATE POLICY "Anon can look up code for booking"
  ON public.patient_referral_codes FOR SELECT TO anon
  USING (true);

CREATE POLICY "Patients create own referral codes"
  ON public.patient_referral_codes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = patient_user_id);


-- 2) Referrals: one row per referred friend
CREATE TABLE public.patient_referrals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_user_id UUID NOT NULL,
  clinic_profile_id UUID NOT NULL,
  code TEXT NOT NULL,
  referred_client_id UUID NULL, -- clinic_clients.id once known
  referred_appointment_id UUID NULL,
  referred_email TEXT NULL,
  referred_phone TEXT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
    -- pending | booked | completed | rewarded | rejected
  reward_credit_pennies INTEGER NOT NULL DEFAULT 0,
  reward_points INTEGER NOT NULL DEFAULT 0,
  friend_credit_pennies INTEGER NOT NULL DEFAULT 0,
  rejected_reason TEXT NULL,
  rewarded_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pr_referrer ON public.patient_referrals(referrer_user_id, clinic_profile_id);
CREATE INDEX idx_pr_clinic ON public.patient_referrals(clinic_profile_id);
CREATE INDEX idx_pr_appt ON public.patient_referrals(referred_appointment_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_referrals TO authenticated;
GRANT ALL ON public.patient_referrals TO service_role;

ALTER TABLE public.patient_referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Referrer or clinic reads referrals"
  ON public.patient_referrals FOR SELECT TO authenticated
  USING (auth.uid() = referrer_user_id OR auth.uid() = clinic_profile_id);

CREATE POLICY "Clinic updates referrals"
  ON public.patient_referrals FOR UPDATE TO authenticated
  USING (auth.uid() = clinic_profile_id)
  WITH CHECK (auth.uid() = clinic_profile_id);


-- 3) Credit ledger (per clinic, per patient user)
CREATE TABLE public.patient_credit_ledger (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_user_id UUID NOT NULL,
  clinic_profile_id UUID NOT NULL,
  delta_pennies INTEGER NOT NULL,
  reason TEXT NOT NULL,
    -- referral_reward | referral_welcome | booking_redemption | adjustment
  ref_type TEXT NULL,
  ref_id UUID NULL,
  note TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pcl_patient ON public.patient_credit_ledger(patient_user_id, clinic_profile_id);

GRANT SELECT ON public.patient_credit_ledger TO authenticated;
GRANT ALL ON public.patient_credit_ledger TO service_role;

ALTER TABLE public.patient_credit_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patient or clinic reads credit ledger"
  ON public.patient_credit_ledger FOR SELECT TO authenticated
  USING (auth.uid() = patient_user_id OR auth.uid() = clinic_profile_id);


-- 4) Points ledger (parallel to credit ledger, for future tiers/redemption)
CREATE TABLE public.patient_points_ledger (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_user_id UUID NOT NULL,
  clinic_profile_id UUID NOT NULL,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  ref_type TEXT NULL,
  ref_id UUID NULL,
  note TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ppl_patient ON public.patient_points_ledger(patient_user_id, clinic_profile_id);

GRANT SELECT ON public.patient_points_ledger TO authenticated;
GRANT ALL ON public.patient_points_ledger TO service_role;

ALTER TABLE public.patient_points_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patient or clinic reads points ledger"
  ON public.patient_points_ledger FOR SELECT TO authenticated
  USING (auth.uid() = patient_user_id OR auth.uid() = clinic_profile_id);


-- 5) Per-clinic referral settings
CREATE TABLE public.clinic_referral_settings (
  clinic_profile_id UUID NOT NULL PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT false,
  referrer_credit_pennies INTEGER NOT NULL DEFAULT 2000, -- £20
  referrer_points INTEGER NOT NULL DEFAULT 100,
  friend_credit_pennies INTEGER NOT NULL DEFAULT 1000, -- £10
  trigger_event TEXT NOT NULL DEFAULT 'completed_paid',
    -- booked | completed | completed_paid
  max_rewarded_per_year INTEGER NULL,
  headline TEXT NULL,
  description TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinic_referral_settings TO authenticated;
GRANT SELECT ON public.clinic_referral_settings TO anon; -- public booking page reads program status
GRANT ALL ON public.clinic_referral_settings TO service_role;

ALTER TABLE public.clinic_referral_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view referral settings"
  ON public.clinic_referral_settings FOR SELECT
  USING (true);

CREATE POLICY "Clinic manages own referral settings"
  ON public.clinic_referral_settings FOR ALL TO authenticated
  USING (auth.uid() = clinic_profile_id)
  WITH CHECK (auth.uid() = clinic_profile_id);


-- updated_at triggers (reuse existing function if present)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_pr_updated_at BEFORE UPDATE ON public.patient_referrals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_crs_updated_at BEFORE UPDATE ON public.clinic_referral_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

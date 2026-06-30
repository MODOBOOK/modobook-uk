
-- 1) Deduplicate existing prescriber_referrals: keep oldest per appointment
DELETE FROM public.prescriber_referrals a
USING public.prescriber_referrals b
WHERE a.appointment_id IS NOT NULL
  AND a.appointment_id = b.appointment_id
  AND a.created_at > b.created_at;

-- 2) Unique constraint: one referral per appointment
CREATE UNIQUE INDEX IF NOT EXISTS prescriber_referrals_appointment_unique
  ON public.prescriber_referrals(appointment_id)
  WHERE appointment_id IS NOT NULL;

-- 3) Track chosen clinic visit on appointment (used by trigger for clinic_visit routing)
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS clinic_visit_id uuid REFERENCES public.prescriber_clinic_visits(id);

-- 4) Updated referral-creation trigger: handles same_address + clinic_visit, idempotent
CREATE OR REPLACE FUNCTION public.create_referral_for_appointment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req boolean;
  v_prescriber uuid;
  v_routing text;
BEGIN
  SELECT requires_prescriber, prescriber_user_id, prescriber_routing
    INTO v_req, v_prescriber, v_routing
    FROM public.treatments WHERE id = NEW.treatment_id;
  IF NOT COALESCE(v_req,false) OR v_prescriber IS NULL THEN RETURN NEW; END IF;
  IF v_routing NOT IN ('same_address','clinic_visit') THEN RETURN NEW; END IF;
  IF v_routing = 'clinic_visit' AND NEW.clinic_visit_id IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.prescriber_referrals (
    practitioner_profile_id, prescriber_user_id, treatment_id, appointment_id,
    patient_name, patient_email, patient_phone, routing, status, consent_given_at,
    clinic_visit_id
  ) VALUES (
    NEW.profile_id, v_prescriber, NEW.treatment_id, NEW.id,
    NEW.patient_name, NEW.patient_email, NEW.patient_phone,
    v_routing, 'pending', now(),
    NEW.clinic_visit_id
  )
  ON CONFLICT (appointment_id) WHERE appointment_id IS NOT NULL DO NOTHING;
  RETURN NEW;
END;
$$;

-- 5) Sync appointment booking into clinic_clients (creates/updates profile)
CREATE OR REPLACE FUNCTION public.sync_appointment_to_client()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_addr jsonb := NEW.patient_address;
BEGIN
  IF NEW.patient_email IS NULL OR NEW.patient_email = '' THEN RETURN NEW; END IF;

  SELECT id INTO v_id FROM public.clinic_clients
    WHERE profile_id = NEW.profile_id AND lower(email) = lower(NEW.patient_email)
    LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.clinic_clients (
      profile_id, full_name, email, phone, dob,
      address_line1, address_line2, city, postcode, country
    ) VALUES (
      NEW.profile_id, NEW.patient_name, NEW.patient_email, NEW.patient_phone, NEW.patient_dob,
      v_addr->>'line1', v_addr->>'line2', v_addr->>'city', v_addr->>'postcode', v_addr->>'country'
    );
  ELSE
    UPDATE public.clinic_clients SET
      full_name = COALESCE(NULLIF(full_name,''), NEW.patient_name),
      phone = COALESCE(NULLIF(phone,''), NEW.patient_phone),
      dob = COALESCE(dob, NEW.patient_dob),
      address_line1 = COALESCE(NULLIF(address_line1,''), v_addr->>'line1'),
      address_line2 = COALESCE(NULLIF(address_line2,''), v_addr->>'line2'),
      city = COALESCE(NULLIF(city,''), v_addr->>'city'),
      postcode = COALESCE(NULLIF(postcode,''), v_addr->>'postcode'),
      country = COALESCE(NULLIF(country,''), v_addr->>'country'),
      updated_at = now()
    WHERE id = v_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_appointment_to_client ON public.appointments;
CREATE TRIGGER trg_sync_appointment_to_client
  AFTER INSERT ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.sync_appointment_to_client();

-- 6) Prescriptions table (UK POM-compliant)
CREATE TABLE IF NOT EXISTS public.prescriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id uuid NOT NULL REFERENCES public.prescriber_referrals(id) ON DELETE CASCADE,
  prescriber_user_id uuid NOT NULL,
  practitioner_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES public.appointments(id),
  -- Patient
  patient_name text NOT NULL,
  patient_dob date,
  patient_address text,
  -- Prescriber (snapshot for legal record)
  prescriber_name text NOT NULL,
  prescriber_reg_body text,
  prescriber_reg_number text,
  prescriber_address text,
  -- Clinic letterhead (snapshot)
  clinic_name text,
  clinic_address text,
  clinic_logo_url text,
  -- Medication
  drug_name text NOT NULL,
  drug_form text,
  drug_strength text,
  dose text NOT NULL,
  quantity text NOT NULL,
  directions text NOT NULL,
  -- Repeat / validity
  repeats_allowed integer NOT NULL DEFAULT 0,
  valid_until date,
  -- Signature
  signed_at timestamptz,
  signature_name text,
  signature_data text,  -- base64 PNG of drawn signature
  status text NOT NULL DEFAULT 'draft', -- draft | signed | cancelled
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prescriptions TO authenticated;
GRANT ALL ON public.prescriptions TO service_role;
ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Prescriber manages own prescriptions"
  ON public.prescriptions FOR ALL TO authenticated
  USING (prescriber_user_id = auth.uid())
  WITH CHECK (prescriber_user_id = auth.uid());

CREATE POLICY "Practitioner reads prescriptions on own profile"
  ON public.prescriptions FOR SELECT TO authenticated
  USING (public.is_profile_owner(practitioner_profile_id));

CREATE TRIGGER trg_prescriptions_updated
  BEFORE UPDATE ON public.prescriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7) Care plans table (notes, assessment, plan)
CREATE TABLE IF NOT EXISTS public.care_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id uuid NOT NULL REFERENCES public.prescriber_referrals(id) ON DELETE CASCADE,
  prescriber_user_id uuid NOT NULL,
  practitioner_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES public.appointments(id),
  assessment text,
  notes text,
  plan text,
  follow_up text,
  status text NOT NULL DEFAULT 'draft', -- draft | sent
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.care_plans TO authenticated;
GRANT ALL ON public.care_plans TO service_role;
ALTER TABLE public.care_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Prescriber manages own care plans"
  ON public.care_plans FOR ALL TO authenticated
  USING (prescriber_user_id = auth.uid())
  WITH CHECK (prescriber_user_id = auth.uid());

CREATE POLICY "Practitioner reads care plans on own profile"
  ON public.care_plans FOR SELECT TO authenticated
  USING (public.is_profile_owner(practitioner_profile_id));

CREATE TRIGGER trg_care_plans_updated
  BEFORE UPDATE ON public.care_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

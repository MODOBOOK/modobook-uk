
-- 1. Treatments: prescriber settings
ALTER TABLE public.treatments
  ADD COLUMN IF NOT EXISTS requires_prescriber boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS prescriber_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS prescriber_routing text NOT NULL DEFAULT 'same_address' CHECK (prescriber_routing IN ('same_address','in_person_consult')),
  ADD COLUMN IF NOT EXISTS prescriber_note text;

-- 2. Referrals table
CREATE TABLE IF NOT EXISTS public.prescriber_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  prescriber_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  treatment_id uuid REFERENCES public.treatments(id) ON DELETE SET NULL,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clinic_clients(id) ON DELETE SET NULL,
  patient_name text,
  patient_email text,
  patient_phone text,
  patient_dob date,
  routing text NOT NULL DEFAULT 'same_address' CHECK (routing IN ('same_address','in_person_consult')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','completed')),
  consent_given_at timestamptz DEFAULT now(),
  accepted_at timestamptz,
  declined_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prescriber_referrals TO authenticated;
GRANT ALL ON public.prescriber_referrals TO service_role;

ALTER TABLE public.prescriber_referrals ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_prescriber_referrals_prescriber ON public.prescriber_referrals(prescriber_user_id, status);
CREATE INDEX IF NOT EXISTS idx_prescriber_referrals_profile ON public.prescriber_referrals(practitioner_profile_id);
CREATE INDEX IF NOT EXISTS idx_prescriber_referrals_appt ON public.prescriber_referrals(appointment_id);

-- Practitioner (owner of the profile) can manage referrals on their profile
CREATE POLICY "practitioner manages own referrals"
  ON public.prescriber_referrals
  FOR ALL
  TO authenticated
  USING (public.is_profile_owner(practitioner_profile_id))
  WITH CHECK (public.is_profile_owner(practitioner_profile_id));

-- Assigned prescriber can read referrals addressed to them
CREATE POLICY "prescriber reads own referrals"
  ON public.prescriber_referrals
  FOR SELECT
  TO authenticated
  USING (prescriber_user_id = auth.uid());

-- Assigned prescriber can update (accept/decline/complete/notes) their referrals
CREATE POLICY "prescriber updates own referrals"
  ON public.prescriber_referrals
  FOR UPDATE
  TO authenticated
  USING (prescriber_user_id = auth.uid())
  WITH CHECK (prescriber_user_id = auth.uid());

CREATE TRIGGER trg_prescriber_referrals_updated_at
  BEFORE UPDATE ON public.prescriber_referrals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Trigger: auto-create referral when appointment is booked for a service that requires one
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
  IF COALESCE(v_req,false) AND v_prescriber IS NOT NULL THEN
    INSERT INTO public.prescriber_referrals (
      practitioner_profile_id, prescriber_user_id, treatment_id, appointment_id,
      patient_name, patient_email, patient_phone, routing, status, consent_given_at
    ) VALUES (
      NEW.profile_id, v_prescriber, NEW.treatment_id, NEW.id,
      NEW.patient_name, NEW.patient_email, NEW.patient_phone,
      COALESCE(v_routing,'same_address'), 'pending', now()
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_referral_for_appointment ON public.appointments;
CREATE TRIGGER trg_create_referral_for_appointment
  AFTER INSERT ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.create_referral_for_appointment();

-- 4. Security-definer fn for full record (only after accepted, only by the prescriber)
CREATE OR REPLACE FUNCTION public.prescriber_get_referral_full(p_referral_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref record;
  v_forms jsonb;
  v_consultations jsonb;
  v_appt jsonb;
  v_client jsonb;
BEGIN
  SELECT * INTO v_ref FROM public.prescriber_referrals WHERE id = p_referral_id;
  IF v_ref.id IS NULL THEN RAISE EXCEPTION 'Not found'; END IF;
  IF v_ref.prescriber_user_id <> auth.uid() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF v_ref.status NOT IN ('accepted','completed') THEN RAISE EXCEPTION 'Accept the case to view the full record'; END IF;

  SELECT to_jsonb(a) INTO v_appt FROM public.appointments a WHERE a.id = v_ref.appointment_id;

  IF v_ref.client_id IS NOT NULL THEN
    SELECT to_jsonb(c) INTO v_client FROM public.clinic_clients c WHERE c.id = v_ref.client_id;
  ELSIF v_ref.appointment_id IS NOT NULL AND v_ref.patient_email IS NOT NULL THEN
    SELECT to_jsonb(c) INTO v_client FROM public.clinic_clients c
      WHERE c.profile_id = v_ref.practitioner_profile_id AND lower(c.email) = lower(v_ref.patient_email) LIMIT 1;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', amf.id, 'template_name', mft.name, 'response', amf.response,
    'submitted_at', amf.submitted_at, 'status', amf.status
  )), '[]'::jsonb)
    INTO v_forms
    FROM public.appointment_medical_forms amf
    JOIN public.medical_form_templates mft ON mft.id = amf.template_id
    WHERE amf.appointment_id = v_ref.appointment_id;

  SELECT COALESCE(jsonb_agg(to_jsonb(co)), '[]'::jsonb) INTO v_consultations
    FROM public.consultations co
    WHERE co.appointment_id = v_ref.appointment_id;

  RETURN jsonb_build_object(
    'referral', to_jsonb(v_ref),
    'appointment', v_appt,
    'client', v_client,
    'medical_forms', v_forms,
    'consultations', v_consultations
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.prescriber_get_referral_full(uuid) TO authenticated;

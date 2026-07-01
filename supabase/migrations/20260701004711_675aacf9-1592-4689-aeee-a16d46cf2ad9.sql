
-- 1) Prescribing snippets (short reusable text for directions field)
CREATE TABLE public.prescribing_snippets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prescriber_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prescribing_snippets TO authenticated;
GRANT ALL ON public.prescribing_snippets TO service_role;
ALTER TABLE public.prescribing_snippets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prescriber owns snippets" ON public.prescribing_snippets
  FOR ALL USING (prescriber_user_id = auth.uid())
  WITH CHECK (prescriber_user_id = auth.uid());
CREATE TRIGGER trg_prescribing_snippets_updated_at
  BEFORE UPDATE ON public.prescribing_snippets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Full Rx templates (one-click prescription prefill)
CREATE TABLE public.prescribing_rx_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prescriber_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  drug_name TEXT NOT NULL,
  drug_form TEXT,
  drug_strength TEXT,
  dose TEXT,
  quantity TEXT,
  directions TEXT,
  repeats_allowed INT NOT NULL DEFAULT 0,
  validity_days INT,
  notes TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prescribing_rx_templates TO authenticated;
GRANT ALL ON public.prescribing_rx_templates TO service_role;
ALTER TABLE public.prescribing_rx_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prescriber owns rx templates" ON public.prescribing_rx_templates
  FOR ALL USING (prescriber_user_id = auth.uid())
  WITH CHECK (prescriber_user_id = auth.uid());
CREATE TRIGGER trg_prescribing_rx_templates_updated_at
  BEFORE UPDATE ON public.prescribing_rx_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Walk-in consult support on prescriber_referrals
-- Reuses the referral table so prescriptions + care plans + full record already work.
ALTER TABLE public.prescriber_referrals
  ADD COLUMN IF NOT EXISTS is_walk_in BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS walk_in_note TEXT,
  ADD COLUMN IF NOT EXISTS awaiting_practitioner_close BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS closed_by_practitioner_at TIMESTAMPTZ;

-- Prescriber can create a walk-in referral targeting a connected practitioner.
-- Practitioners already have RLS covering their profile; ensure prescriber can insert
-- referrals where THEY are the prescriber and the practitioner is a linked partner.
CREATE OR REPLACE FUNCTION public.create_walk_in_referral(
  p_practitioner_profile_id UUID,
  p_patient_name TEXT,
  p_patient_email TEXT DEFAULT NULL,
  p_patient_phone TEXT DEFAULT NULL,
  p_patient_dob DATE DEFAULT NULL,
  p_note TEXT DEFAULT NULL,
  p_client_id UUID DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_practitioner_user UUID;
  v_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT user_id INTO v_practitioner_user FROM public.profiles WHERE id = p_practitioner_profile_id;
  IF v_practitioner_user IS NULL THEN RAISE EXCEPTION 'Practitioner not found'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.hub_links
     WHERE status = 'accepted'
       AND ((requester_user_id = auth.uid() AND recipient_user_id = v_practitioner_user)
         OR (recipient_user_id = auth.uid() AND requester_user_id = v_practitioner_user))
  ) THEN
    RAISE EXCEPTION 'You are not linked to this practitioner';
  END IF;
  INSERT INTO public.prescriber_referrals(
    practitioner_profile_id, prescriber_user_id, treatment_id, appointment_id, client_id,
    patient_name, patient_email, patient_phone, patient_dob,
    routing, status, is_walk_in, walk_in_note, awaiting_practitioner_close,
    consent_given_at, accepted_at
  ) VALUES (
    p_practitioner_profile_id, auth.uid(), NULL, NULL, p_client_id,
    p_patient_name, p_patient_email, p_patient_phone, p_patient_dob,
    'walk_in', 'accepted', true, p_note, false,
    now(), now()
  ) RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

-- When prescriber marks the walk-in "sent to practitioner" we flip the flag.
CREATE OR REPLACE FUNCTION public.send_walk_in_to_practitioner(p_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  UPDATE public.prescriber_referrals
     SET awaiting_practitioner_close = true, updated_at = now()
   WHERE id = p_id AND prescriber_user_id = auth.uid() AND is_walk_in = true;
  RETURN true;
END; $$;

-- Practitioner closes a walk-in.
CREATE OR REPLACE FUNCTION public.close_walk_in_as_practitioner(p_id UUID, p_note TEXT DEFAULT NULL)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_profile UUID;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT practitioner_profile_id INTO v_profile FROM public.prescriber_referrals WHERE id = p_id;
  IF v_profile IS NULL OR NOT public.is_profile_owner(v_profile) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  UPDATE public.prescriber_referrals
     SET status = 'completed',
         closed_by_practitioner_at = now(),
         awaiting_practitioner_close = false,
         notes = COALESCE(notes,'') || CASE WHEN p_note IS NOT NULL AND p_note <> '' THEN E'\n[Practitioner close] ' || p_note ELSE '' END,
         updated_at = now()
   WHERE id = p_id AND is_walk_in = true;
  RETURN true;
END; $$;

GRANT EXECUTE ON FUNCTION public.create_walk_in_referral(UUID, TEXT, TEXT, TEXT, DATE, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_walk_in_to_practitioner(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.close_walk_in_as_practitioner(UUID, TEXT) TO authenticated;


-- 1) Prescriber-requested clinic visit days (hidden from patients until approved)
-- Allow prescribers to insert visit requests for practitioners they are linked to.
DROP POLICY IF EXISTS "prescriber_request_visit_insert" ON public.prescriber_clinic_visits;
CREATE POLICY "prescriber_request_visit_insert" ON public.prescriber_clinic_visits
  FOR INSERT TO authenticated
  WITH CHECK (
    prescriber_user_id = auth.uid()
    AND created_by = 'prescriber'
    AND status = 'pending_approval'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.hub_links hl
        ON hl.status = 'accepted'
       AND ((hl.requester_user_id = auth.uid() AND hl.recipient_user_id = p.user_id)
         OR (hl.recipient_user_id = auth.uid() AND hl.requester_user_id = p.user_id))
      WHERE p.id = practitioner_profile_id
    )
  );

-- Approve / decline RPCs for the practitioner
CREATE OR REPLACE FUNCTION public.approve_prescriber_clinic_visit(p_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_profile uuid;
BEGIN
  SELECT practitioner_profile_id INTO v_profile FROM public.prescriber_clinic_visits WHERE id = p_id;
  IF v_profile IS NULL OR NOT public.is_profile_owner(v_profile) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  UPDATE public.prescriber_clinic_visits
    SET status = 'scheduled', updated_at = now()
    WHERE id = p_id AND status = 'pending_approval';
  RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public.decline_prescriber_clinic_visit(p_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_profile uuid;
BEGIN
  SELECT practitioner_profile_id INTO v_profile FROM public.prescriber_clinic_visits WHERE id = p_id;
  IF v_profile IS NULL OR NOT public.is_profile_owner(v_profile) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  UPDATE public.prescriber_clinic_visits
    SET status = 'cancelled', updated_at = now()
    WHERE id = p_id AND status = 'pending_approval';
  RETURN true;
END; $$;

GRANT EXECUTE ON FUNCTION public.approve_prescriber_clinic_visit(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decline_prescriber_clinic_visit(uuid) TO authenticated;

-- Include pending_approval visits in prescriber's own list so they can see the status
CREATE OR REPLACE FUNCTION public.list_my_prescriber_visits()
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT COALESCE(jsonb_agg(row_to_json(x) ORDER BY x.visit_date, x.start_time), '[]'::jsonb)
  INTO v
  FROM (
    SELECT
      cv.id AS visit_id, cv.visit_date, cv.start_time, cv.end_time,
      cv.capacity, cv.notes, cv.status, cv.confirmed_by_prescriber, cv.created_by,
      p.clinic_name, p.id AS practitioner_profile_id,
      l.name AS location_name, l.address_line1, l.city, l.postcode,
      (SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'referral_id', r.id, 'patient_name', r.patient_name,
          'treatment_id', r.treatment_id, 'status', r.status)), '[]'::jsonb)
       FROM public.prescriber_referrals r WHERE r.clinic_visit_id = cv.id) AS bookings
    FROM public.prescriber_clinic_visits cv
    JOIN public.profiles p ON p.id = cv.practitioner_profile_id
    LEFT JOIN public.locations l ON l.id = cv.location_id
    WHERE cv.prescriber_user_id = auth.uid()
      AND cv.visit_date >= current_date - interval '1 day'
  ) x;
  RETURN v;
END; $$;

-- 2) UK private prescription: PDF + auto-save to patient file on signing
ALTER TABLE public.prescriptions
  ADD COLUMN IF NOT EXISTS pdf_url text,
  ADD COLUMN IF NOT EXISTS pdf_path text,
  ADD COLUMN IF NOT EXISTS rx_type text NOT NULL DEFAULT 'private_pom';

CREATE OR REPLACE FUNCTION public.attach_signed_prescription_to_patient()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_client uuid; v_email text;
BEGIN
  IF NEW.status <> 'signed' OR (OLD.status = 'signed') THEN RETURN NEW; END IF;
  -- locate the client on the practitioner's books
  IF NEW.appointment_id IS NOT NULL THEN
    SELECT patient_email INTO v_email FROM public.appointments WHERE id = NEW.appointment_id;
    IF v_email IS NOT NULL THEN
      SELECT id INTO v_client FROM public.clinic_clients
       WHERE profile_id = NEW.practitioner_profile_id AND lower(email) = lower(v_email) LIMIT 1;
    END IF;
  END IF;
  IF v_client IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.client_prescriptions
    (profile_id, client_id, product, dose, directions, prescribed_on, notes)
  VALUES
    (NEW.practitioner_profile_id, v_client,
     trim(coalesce(NEW.drug_name,'') || ' ' || coalesce(NEW.drug_strength,'') || ' ' || coalesce(NEW.drug_form,'')),
     NEW.dose, NEW.directions, (NEW.signed_at)::date,
     'Prescriber: ' || coalesce(NEW.prescriber_name,'') ||
       CASE WHEN NEW.pdf_url IS NOT NULL THEN E'\nPDF: ' || NEW.pdf_url ELSE '' END);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_attach_signed_rx ON public.prescriptions;
CREATE TRIGGER trg_attach_signed_rx
  AFTER UPDATE ON public.prescriptions
  FOR EACH ROW EXECUTE FUNCTION public.attach_signed_prescription_to_patient();

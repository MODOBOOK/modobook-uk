
-- Allergies on client records
ALTER TABLE public.clinic_clients
  ADD COLUMN IF NOT EXISTS has_allergies boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allergies text;

-- Allergy flag + aftercare on appointments
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS has_allergies boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allergies_text text,
  ADD COLUMN IF NOT EXISTS aftercare_html text,
  ADD COLUMN IF NOT EXISTS aftercare_sent_at timestamptz;

-- Allergy flag on consultations
ALTER TABLE public.consultations
  ADD COLUMN IF NOT EXISTS has_allergies boolean NOT NULL DEFAULT false;

-- Auto-detect allergies when a medical form is submitted, and bubble flag to the appointment + linked client
CREATE OR REPLACE FUNCTION public.detect_allergies_from_medical_form()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_text text;
  v_has boolean := false;
  v_email text;
BEGIN
  IF NEW.status <> 'submitted' OR NEW.response IS NULL THEN
    RETURN NEW;
  END IF;
  v_text := lower(NEW.response::text);
  IF v_text LIKE '%allerg%' AND v_text !~ '"[^"]*allerg[^"]*"\s*:\s*(false|null|""|\[\])' THEN
    v_has := true;
  END IF;
  IF v_has THEN
    UPDATE public.appointments
       SET has_allergies = true
     WHERE id = NEW.appointment_id;

    SELECT patient_email INTO v_email FROM public.appointments WHERE id = NEW.appointment_id;
    IF v_email IS NOT NULL THEN
      UPDATE public.clinic_clients
         SET has_allergies = true
       WHERE profile_id = NEW.profile_id
         AND lower(email) = lower(v_email);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_detect_allergies ON public.appointment_medical_forms;
CREATE TRIGGER trg_detect_allergies
AFTER INSERT OR UPDATE ON public.appointment_medical_forms
FOR EACH ROW EXECUTE FUNCTION public.detect_allergies_from_medical_form();

-- Expose aftercare + allergy to public patient-management RPC
DROP FUNCTION IF EXISTS public.get_appointment_by_manage_token(text);
CREATE OR REPLACE FUNCTION public.get_appointment_by_manage_token(p_token text)
RETURNS TABLE(
  id uuid, scheduled_date date, start_time time, end_time time,
  patient_name text, patient_email text, patient_phone text, status text,
  treatment_name text, location_name text, clinic_name text, slug text,
  cancellation_rules jsonb, deposit_policy_text text,
  aftercare_html text, has_allergies boolean
)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT a.id, a.scheduled_date, a.start_time, a.end_time,
         a.patient_name, a.patient_email, a.patient_phone, a.status,
         t.name, l.name, p.clinic_name, p.slug,
         p.cancellation_rules, p.deposit_policy_text,
         a.aftercare_html, a.has_allergies
  FROM public.appointments a
  JOIN public.treatments t ON t.id = a.treatment_id
  JOIN public.profiles p ON p.id = a.profile_id
  LEFT JOIN public.locations l ON l.id = a.location_id
  WHERE a.manage_token = p_token
$$;
GRANT EXECUTE ON FUNCTION public.get_appointment_by_manage_token(text) TO anon, authenticated;

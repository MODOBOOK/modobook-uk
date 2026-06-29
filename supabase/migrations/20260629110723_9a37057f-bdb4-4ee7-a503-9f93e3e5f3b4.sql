
-- 1) Allow standalone form sends from a patient profile (no appointment yet)
ALTER TABLE public.appointment_medical_forms
  ALTER COLUMN appointment_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clinic_clients(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS recipient_email text,
  ADD COLUMN IF NOT EXISTS recipient_phone text,
  ADD COLUMN IF NOT EXISTS last_reminder_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sent_via jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2) Add aftercare configuration to treatments
ALTER TABLE public.treatments
  ADD COLUMN IF NOT EXISTS aftercare_html text,
  ADD COLUMN IF NOT EXISTS aftercare_delay_hours int NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS auto_send_medical_forms boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS auto_send_aftercare boolean NOT NULL DEFAULT true;

-- 3) Aftercare deliveries per appointment
CREATE TABLE IF NOT EXISTS public.appointment_aftercare (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(18), 'hex'),
  send_at timestamptz NOT NULL,
  sent_at timestamptz,
  status text NOT NULL DEFAULT 'scheduled', -- scheduled | sent | failed | cancelled
  body_html text,
  recipient_email text,
  recipient_phone text,
  sent_via jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointment_aftercare TO authenticated;
GRANT ALL ON public.appointment_aftercare TO service_role;
ALTER TABLE public.appointment_aftercare ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages aftercare" ON public.appointment_aftercare FOR ALL
  USING (public.is_profile_owner(profile_id)) WITH CHECK (public.is_profile_owner(profile_id));
CREATE INDEX IF NOT EXISTS idx_aftercare_send_at ON public.appointment_aftercare(send_at) WHERE status = 'scheduled';
CREATE TRIGGER trg_aftercare_updated BEFORE UPDATE ON public.appointment_aftercare
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Store the latest submitted medical-form answers on the patient record so they appear in the profile
ALTER TABLE public.clinic_clients
  ADD COLUMN IF NOT EXISTS medical_form_data jsonb,
  ADD COLUMN IF NOT EXISTS medical_form_updated_at timestamptz;

-- 5) Update submit_medical_form trigger to also populate clinic_clients.medical_form_data
CREATE OR REPLACE FUNCTION public.sync_medical_form_to_client()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_name text;
  v_client_id uuid;
BEGIN
  IF NEW.status <> 'submitted' OR NEW.response IS NULL THEN
    RETURN NEW;
  END IF;

  -- Prefer the explicit client_id on the form row
  IF NEW.client_id IS NOT NULL THEN
    UPDATE public.clinic_clients
       SET medical_form_data = NEW.response,
           medical_form_updated_at = now()
     WHERE id = NEW.client_id AND profile_id = NEW.profile_id;
    RETURN NEW;
  END IF;

  -- Otherwise look up via appointment email/name
  IF NEW.appointment_id IS NOT NULL THEN
    SELECT patient_email, patient_name INTO v_email, v_name
      FROM public.appointments WHERE id = NEW.appointment_id;
    IF v_email IS NOT NULL THEN
      SELECT id INTO v_client_id FROM public.clinic_clients
        WHERE profile_id = NEW.profile_id AND lower(email) = lower(v_email) LIMIT 1;
    END IF;
    IF v_client_id IS NULL AND v_name IS NOT NULL THEN
      SELECT id INTO v_client_id FROM public.clinic_clients
        WHERE profile_id = NEW.profile_id AND lower(full_name) = lower(v_name) LIMIT 1;
    END IF;
    IF v_client_id IS NOT NULL THEN
      UPDATE public.clinic_clients
         SET medical_form_data = NEW.response,
             medical_form_updated_at = now()
       WHERE id = v_client_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_medical_form_to_client ON public.appointment_medical_forms;
CREATE TRIGGER trg_sync_medical_form_to_client
AFTER INSERT OR UPDATE ON public.appointment_medical_forms
FOR EACH ROW EXECUTE FUNCTION public.sync_medical_form_to_client();

-- 6) RPC to send a medical form to a specific client (standalone, no appointment)
CREATE OR REPLACE FUNCTION public.send_medical_form_to_client(
  p_client_id uuid,
  p_template_id uuid,
  p_email text,
  p_phone text
) RETURNS TABLE(id uuid, token text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile uuid;
BEGIN
  SELECT profile_id INTO v_profile FROM public.clinic_clients WHERE id = p_client_id;
  IF v_profile IS NULL OR NOT public.is_profile_owner(v_profile) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  INSERT INTO public.appointment_medical_forms (
    appointment_id, template_id, profile_id, client_id, recipient_email, recipient_phone
  ) VALUES (
    NULL, p_template_id, v_profile, p_client_id, p_email, p_phone
  ) RETURNING appointment_medical_forms.id, appointment_medical_forms.token;
END;
$$;

-- 7) Adjust get_medical_form_by_token to handle standalone (no-appointment) form sends
CREATE OR REPLACE FUNCTION public.get_medical_form_by_token(p_token text)
 RETURNS TABLE(form_id uuid, status text, template_name text, template_schema jsonb,
   patient_name text, scheduled_date date, start_time time without time zone,
   treatment_name text, clinic_name text, brand_color text, response jsonb)
 LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT
    amf.id, amf.status,
    mft.name, mft.schema,
    COALESCE(a.patient_name, cc.full_name)::text AS patient_name,
    a.scheduled_date,
    a.start_time,
    COALESCE(t.name, 'Medical Form')::text AS treatment_name,
    p.clinic_name, p.brand_color,
    amf.response
  FROM public.appointment_medical_forms amf
  JOIN public.medical_form_templates mft ON mft.id = amf.template_id
  LEFT JOIN public.appointments a ON a.id = amf.appointment_id
  LEFT JOIN public.treatments t ON t.id = a.treatment_id
  LEFT JOIN public.clinic_clients cc ON cc.id = amf.client_id
  JOIN public.profiles p ON p.id = amf.profile_id
  WHERE amf.token = p_token
$function$;

-- 8) Schedule aftercare automatically when an appointment is created (if treatment opts in)
CREATE OR REPLACE FUNCTION public.schedule_appointment_aftercare()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auto boolean;
  v_delay int;
  v_html text;
  v_send_at timestamptz;
BEGIN
  SELECT auto_send_aftercare, aftercare_delay_hours, aftercare_html
    INTO v_auto, v_delay, v_html
    FROM public.treatments WHERE id = NEW.treatment_id;
  IF NOT COALESCE(v_auto, false) OR COALESCE(v_html,'') = '' THEN
    RETURN NEW;
  END IF;
  v_send_at := (NEW.scheduled_date + NEW.end_time)::timestamptz + (COALESCE(v_delay,2) || ' hours')::interval;
  INSERT INTO public.appointment_aftercare (
    appointment_id, profile_id, send_at, body_html, recipient_email, recipient_phone
  ) VALUES (
    NEW.id, NEW.profile_id, v_send_at, v_html, NEW.patient_email, NEW.patient_phone
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_schedule_aftercare ON public.appointments;
CREATE TRIGGER trg_schedule_aftercare
AFTER INSERT ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.schedule_appointment_aftercare();

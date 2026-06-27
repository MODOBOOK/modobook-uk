
-- 1. CLINIC CLIENTS ----------------------------------------------------------
CREATE TABLE public.clinic_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text,
  phone text,
  dob date,
  gender text,
  address text,
  group_name text,
  notes text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX clinic_clients_profile_idx ON public.clinic_clients(profile_id);
CREATE INDEX clinic_clients_email_idx ON public.clinic_clients(profile_id, lower(email));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinic_clients TO authenticated;
GRANT ALL ON public.clinic_clients TO service_role;
ALTER TABLE public.clinic_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Practitioner manages own clients" ON public.clinic_clients
  FOR ALL TO authenticated
  USING (public.is_profile_owner(profile_id))
  WITH CHECK (public.is_profile_owner(profile_id));

CREATE TRIGGER clinic_clients_updated_at
  BEFORE UPDATE ON public.clinic_clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 2. MEDICAL FORM CATEGORIES & TEMPLATE EXTENSIONS --------------------------
CREATE TABLE public.medical_form_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX medical_form_categories_profile_idx ON public.medical_form_categories(profile_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.medical_form_categories TO authenticated;
GRANT ALL ON public.medical_form_categories TO service_role;
ALTER TABLE public.medical_form_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Practitioner manages own form categories" ON public.medical_form_categories
  FOR ALL TO authenticated
  USING (public.is_profile_owner(profile_id))
  WITH CHECK (public.is_profile_owner(profile_id));

ALTER TABLE public.medical_form_templates
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.medical_form_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS validity text NOT NULL DEFAULT 'always_required',
  ADD COLUMN IF NOT EXISTS is_published boolean NOT NULL DEFAULT true;


-- 3. TREATMENT <-> MEDICAL FORM JOIN ---------------------------------------
CREATE TABLE public.treatment_medical_forms (
  treatment_id uuid NOT NULL REFERENCES public.treatments(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES public.medical_form_templates(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (treatment_id, template_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.treatment_medical_forms TO authenticated;
GRANT SELECT ON public.treatment_medical_forms TO anon;
GRANT ALL ON public.treatment_medical_forms TO service_role;
ALTER TABLE public.treatment_medical_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read treatment form links" ON public.treatment_medical_forms
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Owner manages treatment form links" ON public.treatment_medical_forms
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.treatments t WHERE t.id = treatment_id AND public.is_profile_owner(t.profile_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.treatments t WHERE t.id = treatment_id AND public.is_profile_owner(t.profile_id)));


-- 4. PER-APPOINTMENT MEDICAL FORMS -----------------------------------------
CREATE TABLE public.appointment_medical_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES public.medical_form_templates(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  status text NOT NULL DEFAULT 'pending',
  response jsonb,
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX appt_medforms_appt_idx ON public.appointment_medical_forms(appointment_id);
CREATE INDEX appt_medforms_profile_idx ON public.appointment_medical_forms(profile_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointment_medical_forms TO authenticated;
GRANT ALL ON public.appointment_medical_forms TO service_role;
ALTER TABLE public.appointment_medical_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages appointment medical forms" ON public.appointment_medical_forms
  FOR ALL TO authenticated
  USING (public.is_profile_owner(profile_id))
  WITH CHECK (public.is_profile_owner(profile_id));

-- Public RPC: get by token
CREATE OR REPLACE FUNCTION public.get_medical_form_by_token(p_token text)
RETURNS TABLE (
  form_id uuid,
  status text,
  template_name text,
  template_schema jsonb,
  patient_name text,
  scheduled_date date,
  start_time time,
  treatment_name text,
  clinic_name text,
  brand_color text,
  response jsonb
)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT
    amf.id, amf.status,
    mft.name, mft.schema,
    a.patient_name, a.scheduled_date, a.start_time,
    t.name, p.clinic_name, p.brand_color,
    amf.response
  FROM public.appointment_medical_forms amf
  JOIN public.medical_form_templates mft ON mft.id = amf.template_id
  JOIN public.appointments a ON a.id = amf.appointment_id
  JOIN public.treatments t ON t.id = a.treatment_id
  JOIN public.profiles p ON p.id = amf.profile_id
  WHERE amf.token = p_token
$$;
REVOKE EXECUTE ON FUNCTION public.get_medical_form_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_medical_form_by_token(text) TO anon, authenticated;

-- Public RPC: submit form
CREATE OR REPLACE FUNCTION public.submit_medical_form(p_token text, p_response jsonb)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM public.appointment_medical_forms
    WHERE token = p_token AND status = 'pending';
  IF v_id IS NULL THEN RETURN false; END IF;
  UPDATE public.appointment_medical_forms
    SET response = p_response, status = 'submitted', submitted_at = now()
    WHERE id = v_id;
  RETURN true;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.submit_medical_form(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_medical_form(text, jsonb) TO anon, authenticated;


-- 5. AUTO-CREATE per-appointment forms on insert ---------------------------
CREATE OR REPLACE FUNCTION public.create_appointment_medical_forms()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.appointment_medical_forms (appointment_id, template_id, profile_id)
  SELECT NEW.id, tmf.template_id, NEW.profile_id
  FROM public.treatment_medical_forms tmf
  WHERE tmf.treatment_id = NEW.treatment_id
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS appointments_create_medical_forms ON public.appointments;
CREATE TRIGGER appointments_create_medical_forms
  AFTER INSERT ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.create_appointment_medical_forms();


-- 1. Patient accounts
CREATE TABLE public.patient_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clinic_clients(id) ON DELETE SET NULL,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, profile_id)
);
CREATE INDEX idx_patient_accounts_user ON public.patient_accounts(user_id);
CREATE INDEX idx_patient_accounts_profile ON public.patient_accounts(profile_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_accounts TO authenticated;
GRANT ALL ON public.patient_accounts TO service_role;
ALTER TABLE public.patient_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pa_select" ON public.patient_accounts FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_profile_owner(profile_id));
CREATE POLICY "pa_insert" ON public.patient_accounts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "pa_update" ON public.patient_accounts FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER trg_patient_accounts_updated BEFORE UPDATE ON public.patient_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Shared notes
ALTER TABLE public.client_notes
  ADD COLUMN IF NOT EXISTS visible_to_patient boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS shared_at timestamptz;

-- 3. Reschedule counter
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS reschedule_count integer NOT NULL DEFAULT 0;

-- 4. Helpers
CREATE OR REPLACE FUNCTION public.is_patient_of_profile(_profile_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.patient_accounts
                 WHERE user_id = auth.uid() AND profile_id = _profile_id);
$$;

CREATE OR REPLACE FUNCTION public.current_patient_client_id(_profile_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT client_id FROM public.patient_accounts
  WHERE user_id = auth.uid() AND profile_id = _profile_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_patient_email(_profile_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT lower(email) FROM public.patient_accounts
  WHERE user_id = auth.uid() AND profile_id = _profile_id LIMIT 1;
$$;

-- 5. RLS additions
CREATE POLICY "Patient reads own appointments"
  ON public.appointments FOR SELECT TO authenticated
  USING (
    public.is_patient_of_profile(profile_id)
    AND (patient_user_id = auth.uid()
         OR lower(patient_email) = public.current_patient_email(profile_id))
  );

CREATE POLICY "Patient reads own consents"
  ON public.appointment_consents FOR SELECT TO authenticated
  USING (
    public.is_patient_of_profile(profile_id)
    AND EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.id = appointment_consents.appointment_id
        AND (a.patient_user_id = auth.uid()
             OR lower(a.patient_email) = public.current_patient_email(a.profile_id))
    )
  );

CREATE POLICY "Patient reads own medical forms"
  ON public.appointment_medical_forms FOR SELECT TO authenticated
  USING (
    public.is_patient_of_profile(profile_id)
    AND (
      client_id = public.current_patient_client_id(profile_id)
      OR EXISTS (
        SELECT 1 FROM public.appointments a
        WHERE a.id = appointment_medical_forms.appointment_id
          AND (a.patient_user_id = auth.uid()
               OR lower(a.patient_email) = public.current_patient_email(a.profile_id))
      )
    )
  );

CREATE POLICY "Patient reads shared notes"
  ON public.client_notes FOR SELECT TO authenticated
  USING (
    visible_to_patient = true
    AND client_id = public.current_patient_client_id(profile_id)
  );

CREATE POLICY "Patient reads own aftercare"
  ON public.appointment_aftercare FOR SELECT TO authenticated
  USING (
    public.is_patient_of_profile(profile_id)
    AND EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.id = appointment_aftercare.appointment_id
        AND (a.patient_user_id = auth.uid()
             OR lower(a.patient_email) = public.current_patient_email(a.profile_id))
    )
  );

CREATE POLICY "Patient reads own payments"
  ON public.payments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.appointments a
      WHERE a.id = payments.appointment_id
        AND public.is_patient_of_profile(a.profile_id)
        AND (a.patient_user_id = auth.uid()
             OR lower(a.patient_email) = public.current_patient_email(a.profile_id))
    )
  );

CREATE POLICY "Patient reads own client record"
  ON public.clinic_clients FOR SELECT TO authenticated
  USING (id = public.current_patient_client_id(profile_id));

-- 6. Link RPC
CREATE OR REPLACE FUNCTION public.link_patient_account(p_slug text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_profile uuid; v_email text; v_name text; v_client uuid; v_acc uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT id INTO v_profile FROM public.profiles WHERE slug = p_slug AND active = true;
  IF v_profile IS NULL THEN RAISE EXCEPTION 'Practitioner not found'; END IF;

  SELECT email, COALESCE(raw_user_meta_data->>'full_name', email) INTO v_email, v_name
    FROM auth.users WHERE id = auth.uid();

  SELECT id INTO v_client FROM public.clinic_clients
    WHERE profile_id = v_profile AND lower(email) = lower(v_email) LIMIT 1;

  IF v_client IS NULL THEN
    INSERT INTO public.clinic_clients (profile_id, full_name, email)
    VALUES (v_profile, COALESCE(v_name, v_email), v_email)
    RETURNING id INTO v_client;
  END IF;

  -- backfill patient_user_id on existing appointments for this email
  UPDATE public.appointments SET patient_user_id = auth.uid()
    WHERE profile_id = v_profile AND patient_user_id IS NULL
      AND lower(patient_email) = lower(v_email);

  INSERT INTO public.patient_accounts (user_id, profile_id, client_id, email)
  VALUES (auth.uid(), v_profile, v_client, v_email)
  ON CONFLICT (user_id, profile_id) DO UPDATE
    SET client_id = EXCLUDED.client_id, email = EXCLUDED.email, updated_at = now()
  RETURNING id INTO v_acc;
  RETURN v_acc;
END; $$;

-- 7. Cancel RPC
CREATE OR REPLACE FUNCTION public.patient_cancel_appointment(p_appointment_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_appt record; v_min_hours int; v_hours_until numeric;
BEGIN
  SELECT a.*, p.allow_patient_cancel, p.cancellation_rules INTO v_appt
    FROM public.appointments a JOIN public.profiles p ON p.id = a.profile_id
    WHERE a.id = p_appointment_id;
  IF v_appt.id IS NULL THEN RAISE EXCEPTION 'Appointment not found'; END IF;
  IF NOT public.is_patient_of_profile(v_appt.profile_id) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF v_appt.status IN ('cancelled','completed') THEN RAISE EXCEPTION 'Cannot cancel a % appointment', v_appt.status; END IF;
  IF COALESCE(v_appt.allow_patient_cancel, true) = false THEN
    RAISE EXCEPTION 'Online cancellation is disabled. Please contact the clinic.'; END IF;
  v_min_hours := COALESCE((v_appt.cancellation_rules->>'min_notice_hours')::int, 0);
  v_hours_until := EXTRACT(EPOCH FROM ((v_appt.scheduled_date + v_appt.start_time)::timestamptz - now())) / 3600;
  IF v_hours_until < v_min_hours THEN
    RAISE EXCEPTION 'Cancellations require at least % hours notice', v_min_hours; END IF;
  UPDATE public.appointments SET status = 'cancelled' WHERE id = p_appointment_id;
  RETURN jsonb_build_object('ok', true);
END; $$;

-- 8. Reschedule RPC
CREATE OR REPLACE FUNCTION public.patient_reschedule_appointment(p_appointment_id uuid, p_date date, p_start time, p_end time)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_appt record; v_min_hours int; v_max int; v_hours_until numeric;
BEGIN
  SELECT a.*, p.allow_patient_reschedule, p.cancellation_rules INTO v_appt
    FROM public.appointments a JOIN public.profiles p ON p.id = a.profile_id
    WHERE a.id = p_appointment_id;
  IF v_appt.id IS NULL THEN RAISE EXCEPTION 'Appointment not found'; END IF;
  IF NOT public.is_patient_of_profile(v_appt.profile_id) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF v_appt.status IN ('cancelled','completed') THEN RAISE EXCEPTION 'Cannot reschedule a % appointment', v_appt.status; END IF;
  IF COALESCE(v_appt.allow_patient_reschedule, true) = false THEN
    RAISE EXCEPTION 'Online rescheduling is disabled. Please contact the clinic.'; END IF;
  v_min_hours := COALESCE((v_appt.cancellation_rules->>'reschedule_min_notice_hours')::int,
                          (v_appt.cancellation_rules->>'min_notice_hours')::int, 0);
  v_max := COALESCE((v_appt.cancellation_rules->>'max_patient_reschedules')::int, 999);
  v_hours_until := EXTRACT(EPOCH FROM ((v_appt.scheduled_date + v_appt.start_time)::timestamptz - now())) / 3600;
  IF v_hours_until < v_min_hours THEN
    RAISE EXCEPTION 'Rescheduling requires at least % hours notice', v_min_hours; END IF;
  IF COALESCE(v_appt.reschedule_count, 0) >= v_max THEN
    RAISE EXCEPTION 'Reschedule limit reached. Please contact the clinic.'; END IF;
  UPDATE public.appointments
    SET scheduled_date = p_date, start_time = p_start, end_time = p_end,
        reschedule_count = COALESCE(reschedule_count,0) + 1, updated_at = now()
    WHERE id = p_appointment_id;
  RETURN jsonb_build_object('ok', true);
END; $$;

GRANT EXECUTE ON FUNCTION public.link_patient_account(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.patient_cancel_appointment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.patient_reschedule_appointment(uuid, date, time, time) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_patient_of_profile(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_patient_client_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_patient_email(uuid) TO authenticated;

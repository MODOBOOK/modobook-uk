
-- Add late-cancel behaviour toggle
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS late_cancel_mode text NOT NULL DEFAULT 'block'
  CHECK (late_cancel_mode IN ('block','warn_agree'));

-- Rewrite patient_cancel_appointment to use dedicated cols + agreement flow
CREATE OR REPLACE FUNCTION public.patient_cancel_appointment(
  p_appointment_id uuid,
  p_confirm_late boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_appt record;
  v_cutoff int;
  v_mode text;
  v_hours_until numeric;
BEGIN
  SELECT a.*, p.allow_patient_cancel, p.patient_cancel_cutoff_hours, p.late_cancel_mode
    INTO v_appt
    FROM public.appointments a
    JOIN public.profiles p ON p.id = a.profile_id
    WHERE a.id = p_appointment_id;
  IF v_appt.id IS NULL THEN RAISE EXCEPTION 'Appointment not found'; END IF;
  IF NOT public.is_patient_of_profile(v_appt.profile_id) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF v_appt.status IN ('cancelled','completed') THEN
    RAISE EXCEPTION 'Cannot cancel a % appointment', v_appt.status;
  END IF;
  IF COALESCE(v_appt.allow_patient_cancel, true) = false THEN
    RAISE EXCEPTION 'Online cancellation is disabled. Please contact the clinic.';
  END IF;

  v_cutoff := COALESCE(v_appt.patient_cancel_cutoff_hours, 0);
  v_mode := COALESCE(v_appt.late_cancel_mode, 'block');
  v_hours_until := EXTRACT(EPOCH FROM ((v_appt.scheduled_date + v_appt.start_time)::timestamptz - now())) / 3600;

  IF v_hours_until < v_cutoff THEN
    IF v_mode = 'block' THEN
      RAISE EXCEPTION 'Cancellations within % hours of your appointment must be done by contacting the clinic directly.', v_cutoff;
    ELSIF NOT COALESCE(p_confirm_late, false) THEN
      RAISE EXCEPTION 'AGREEMENT_REQUIRED: You are cancelling within % hours of the appointment. A cancellation fee may apply per the clinic''s policy.', v_cutoff;
    END IF;
  END IF;

  UPDATE public.appointments SET status = 'cancelled' WHERE id = p_appointment_id;
  RETURN jsonb_build_object('ok', true, 'late', v_hours_until < v_cutoff);
END; $$;

-- Rewrite patient_reschedule_appointment to use dedicated cols
CREATE OR REPLACE FUNCTION public.patient_reschedule_appointment(
  p_appointment_id uuid,
  p_date date,
  p_start time,
  p_end time
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_appt record;
  v_cutoff int;
  v_max int;
  v_hours_until numeric;
BEGIN
  SELECT a.*, p.allow_patient_reschedule, p.patient_reschedule_cutoff_hours, p.patient_reschedule_max
    INTO v_appt
    FROM public.appointments a JOIN public.profiles p ON p.id = a.profile_id
    WHERE a.id = p_appointment_id;
  IF v_appt.id IS NULL THEN RAISE EXCEPTION 'Appointment not found'; END IF;
  IF NOT public.is_patient_of_profile(v_appt.profile_id) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF v_appt.status IN ('cancelled','completed') THEN
    RAISE EXCEPTION 'Cannot reschedule a % appointment', v_appt.status;
  END IF;
  IF COALESCE(v_appt.allow_patient_reschedule, true) = false THEN
    RAISE EXCEPTION 'Online rescheduling is disabled. Please contact the clinic.';
  END IF;

  v_cutoff := COALESCE(v_appt.patient_reschedule_cutoff_hours, 0);
  v_max := COALESCE(v_appt.patient_reschedule_max, 999);
  v_hours_until := EXTRACT(EPOCH FROM ((v_appt.scheduled_date + v_appt.start_time)::timestamptz - now())) / 3600;

  IF v_hours_until < v_cutoff THEN
    RAISE EXCEPTION 'Rescheduling requires at least % hours notice. Please contact the clinic.', v_cutoff;
  END IF;
  IF COALESCE(v_appt.reschedule_count, 0) >= v_max THEN
    RAISE EXCEPTION 'Reschedule limit reached. Please contact the clinic.';
  END IF;

  UPDATE public.appointments
    SET scheduled_date = p_date, start_time = p_start, end_time = p_end,
        reschedule_count = COALESCE(reschedule_count,0) + 1, updated_at = now()
    WHERE id = p_appointment_id;
  RETURN jsonb_build_object('ok', true);
END; $$;

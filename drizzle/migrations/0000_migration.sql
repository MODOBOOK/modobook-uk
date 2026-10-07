CREATE OR REPLACE FUNCTION public.notify_patient_cancel_or_move()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_name text; v_treatment text; v_uid uuid := auth.uid();
BEGIN
  IF NEW.is_demo IS TRUE OR OLD.status::text <> 'confirmed' THEN RETURN NEW; END IF;
  -- Only alert for patient-side changes (patient account, or token/system links), not clinic staff edits
  IF v_uid IS NOT NULL AND v_uid IS DISTINCT FROM NEW.patient_user_id THEN RETURN NEW; END IF;
  v_name := COALESCE(NEW.patient_name, NEW.patient_email, 'A patient');
  v_treatment := COALESCE(NEW.treatment_name_snapshot, 'their appointment');
  IF NEW.status::text = 'cancelled' THEN
    PERFORM public.create_notification(NEW.profile_id, 'booking', 'Appointment cancelled',
      v_name || ' cancelled ' || v_treatment || ' on ' || to_char(OLD.scheduled_date, 'Dy DD Mon') || ' at ' || to_char(OLD.start_time, 'HH24:MI'),
      '❌', '/dashboard/bookings', NEW.id, 'appointment');
  ELSIF NEW.status::text = 'confirmed' AND (NEW.scheduled_date IS DISTINCT FROM OLD.scheduled_date OR NEW.start_time IS DISTINCT FROM OLD.start_time) THEN
    PERFORM public.create_notification(NEW.profile_id, 'booking', 'Appointment rescheduled',
      v_name || ' moved ' || v_treatment || ' from ' || to_char(OLD.scheduled_date, 'DD Mon') || ' ' || to_char(OLD.start_time, 'HH24:MI')
      || ' to ' || to_char(NEW.scheduled_date, 'Dy DD Mon') || ' at ' || to_char(NEW.start_time, 'HH24:MI'),
      '🔁', '/dashboard/bookings', NEW.id, 'appointment');
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_patient_cancel_or_move ON public.appointments;
CREATE TRIGGER trg_notify_patient_cancel_or_move AFTER UPDATE OF status, scheduled_date, start_time ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.notify_patient_cancel_or_move();
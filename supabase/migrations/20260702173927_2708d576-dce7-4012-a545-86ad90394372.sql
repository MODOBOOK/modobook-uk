
CREATE OR REPLACE FUNCTION public.notify_new_booking()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_name text; v_treatment text;
BEGIN
  IF (TG_OP = 'INSERT' AND (NEW.status = 'confirmed' OR NEW.payment_status = 'paid'))
     OR (TG_OP = 'UPDATE'
         AND ((NEW.status = 'confirmed' AND COALESCE(OLD.status::text,'') <> 'confirmed')
              OR (NEW.payment_status = 'paid' AND COALESCE(OLD.payment_status::text,'') <> 'paid')))
  THEN
    v_name := COALESCE(NEW.patient_name, NEW.patient_email, 'A patient');
    v_treatment := COALESCE(NEW.treatment_name_snapshot, 'a treatment');
    PERFORM public.create_notification(
      NEW.profile_id, 'booking',
      'New booking!',
      v_name || ' booked ' || v_treatment || ' on ' || to_char(NEW.scheduled_date, 'DD Mon') || ' at ' || to_char(NEW.start_time, 'HH24:MI'),
      '🎉', '/dashboard/bookings', NEW.id, 'appointment'
    );
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.notify_medical_form_submitted()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'submitted' AND COALESCE(OLD.status::text,'') <> 'submitted' THEN
    PERFORM public.create_notification(
      NEW.profile_id, 'form',
      'Medical form completed',
      'A patient just submitted a medical form.',
      '📝', '/dashboard/patients', NEW.id, 'medical_form'
    );
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.notify_consent_signed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_profile uuid;
BEGIN
  IF NEW.status = 'signed' AND COALESCE(OLD.status::text,'') <> 'signed' THEN
    SELECT profile_id INTO v_profile FROM public.appointments WHERE id = NEW.appointment_id;
    PERFORM public.create_notification(
      v_profile, 'consent',
      'Consent signed',
      'A patient just signed a consent form.',
      '✍️', '/dashboard/patients', NEW.id, 'consent'
    );
  END IF;
  RETURN NEW;
END; $$;

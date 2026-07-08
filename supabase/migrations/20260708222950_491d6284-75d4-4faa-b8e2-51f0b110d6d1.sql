CREATE OR REPLACE FUNCTION public.notify_medical_form_submitted()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_name text;
BEGIN
  IF NEW.status = 'submitted' AND COALESCE(OLD.status::text,'') <> 'submitted' THEN
    -- Prefer the linked appointment's patient name
    SELECT COALESCE(NULLIF(patient_name, ''), NULLIF(patient_email, ''))
    INTO v_name
    FROM public.appointments
    WHERE id = NEW.appointment_id;

    -- Fall back to the linked clinic client for standalone forms
    IF v_name IS NULL AND NEW.client_id IS NOT NULL THEN
      SELECT COALESCE(NULLIF(full_name, ''), NULLIF(email, ''))
      INTO v_name
      FROM public.clinic_clients
      WHERE id = NEW.client_id;
    END IF;

    PERFORM public.create_notification(
      NEW.profile_id, 'form',
      'Medical form completed',
      COALESCE(v_name, 'A patient') || ' just submitted a medical form.',
      '📝', '/dashboard/patients', NEW.id, 'medical_form'
    );
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.notify_new_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_name text; v_treatment text;
BEGIN
  IF (TG_OP = 'INSERT' AND (NEW.status = 'confirmed' OR NEW.payment_status = 'paid'))
     OR (TG_OP = 'UPDATE'
         AND ((NEW.status = 'confirmed' AND OLD.status IS DISTINCT FROM 'confirmed'::appointment_status)
              OR (NEW.payment_status = 'paid' AND COALESCE(OLD.payment_status,'') <> 'paid')))
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
END; $function$;
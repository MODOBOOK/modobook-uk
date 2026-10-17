CREATE OR REPLACE FUNCTION public.release_cancelled_model_slot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status::text = 'cancelled' THEN
    UPDATE public.model_slots
    SET booked_appointment_id = NULL, updated_at = now()
    WHERE booked_appointment_id = NEW.id
      AND profile_id = NEW.profile_id;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.release_cancelled_model_slot() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_release_cancelled_model_slot
AFTER UPDATE OF status ON public.appointments
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status::text = 'cancelled')
EXECUTE FUNCTION public.release_cancelled_model_slot();
COMMENT ON FUNCTION public.release_cancelled_model_slot() IS 'Release only the slot still claimed by this appointment when any cancellation path runs, including abandoned payment holds.';
ALTER TABLE public.treatments ADD COLUMN IF NOT EXISTS booking_cap integer;

ALTER TABLE public.model_slots ADD COLUMN IF NOT EXISTS is_flexible boolean NOT NULL DEFAULT false;
ALTER TABLE public.model_slots ALTER COLUMN slot_date DROP NOT NULL;
ALTER TABLE public.model_slots ALTER COLUMN start_time DROP NOT NULL;
ALTER TABLE public.model_slots ALTER COLUMN end_time DROP NOT NULL;

ALTER TABLE public.model_slots DROP CONSTRAINT IF EXISTS model_slots_flexible_check;
ALTER TABLE public.model_slots ADD CONSTRAINT model_slots_flexible_check CHECK (
  (is_flexible = true AND slot_date IS NULL AND start_time IS NULL AND end_time IS NULL)
  OR (is_flexible = false AND slot_date IS NOT NULL AND start_time IS NOT NULL AND end_time IS NOT NULL)
);

CREATE OR REPLACE FUNCTION public.get_public_treatment_booking_counts(p_profile_id uuid)
RETURNS TABLE(treatment_id uuid, booked_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT treatment_id, count(*)::bigint
  FROM public.appointments
  WHERE profile_id = p_profile_id
    AND treatment_id IS NOT NULL
    AND status IN ('confirmed'::appointment_status, 'completed'::appointment_status, 'pending'::appointment_status)
  GROUP BY treatment_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_treatment_booking_counts(uuid) TO anon, authenticated;
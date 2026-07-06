DROP POLICY IF EXISTS "Public read active future model slots" ON public.model_slots;

CREATE POLICY "Public read active available model slots"
ON public.model_slots
FOR SELECT
TO anon, authenticated
USING (
  active = true
  AND booked_appointment_id IS NULL
  AND (
    is_flexible = true
    OR slot_date >= CURRENT_DATE
  )
  AND is_active_profile(profile_id)
);
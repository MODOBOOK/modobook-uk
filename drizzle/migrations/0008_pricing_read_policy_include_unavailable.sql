-- The public read policy only exposed rows with available = true, so a row
-- written with available = false (a location unticked for a treatment) became
-- invisible to the booking page, which treats "no row" as "offered here".
-- Relax the public read so unticked rows are visible; hiding is decided by the
-- booking page from the row's available flag.
DROP POLICY IF EXISTS "Public can view pricing for available treatments" ON public.treatment_location_pricing;
CREATE POLICY "Public can view pricing for active clinic treatments"
  ON public.treatment_location_pricing
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1
      FROM public.treatments t
      WHERE t.id = treatment_location_pricing.treatment_id
        AND is_active_profile(t.profile_id)
    )
  );
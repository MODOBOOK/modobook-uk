CREATE POLICY "Clinic can add points for its patients"
ON public.patient_points_ledger
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = clinic_profile_id);

GRANT SELECT, INSERT ON public.patient_points_ledger TO authenticated;
GRANT ALL ON public.patient_points_ledger TO service_role;
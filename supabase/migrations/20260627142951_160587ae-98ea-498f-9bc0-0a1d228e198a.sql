
-- Link bookings to signed-in patients, and let practitioners add patient-visible notes.
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS patient_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS practitioner_notes text;

CREATE INDEX IF NOT EXISTS appointments_patient_user_id_idx
  ON public.appointments(patient_user_id);

-- Allow signed-in patients to read their own appointments.
DROP POLICY IF EXISTS "Patients can view their own appointments" ON public.appointments;
CREATE POLICY "Patients can view their own appointments"
  ON public.appointments
  FOR SELECT
  TO authenticated
  USING (patient_user_id = auth.uid());

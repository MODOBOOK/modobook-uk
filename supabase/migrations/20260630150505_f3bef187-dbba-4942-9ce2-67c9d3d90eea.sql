
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS patient_reschedule_max integer,
  ADD COLUMN IF NOT EXISTS patient_reschedule_cutoff_hours integer,
  ADD COLUMN IF NOT EXISTS patient_cancel_cutoff_hours integer;

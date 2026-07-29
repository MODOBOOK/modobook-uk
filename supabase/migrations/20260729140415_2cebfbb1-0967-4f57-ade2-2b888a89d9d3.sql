ALTER TABLE public.prescriber_clinic_visits
  ADD COLUMN IF NOT EXISTS price numeric,
  ADD COLUMN IF NOT EXISTS treatment_id uuid REFERENCES public.treatments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recurrence_group uuid;

CREATE INDEX IF NOT EXISTS prescriber_clinic_visits_recurrence_group_idx
  ON public.prescriber_clinic_visits (recurrence_group);
ALTER TABLE public.model_slots
  ADD COLUMN IF NOT EXISTS practitioner_id uuid REFERENCES public.practitioners(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS model_slots_practitioner_id_idx ON public.model_slots (practitioner_id);
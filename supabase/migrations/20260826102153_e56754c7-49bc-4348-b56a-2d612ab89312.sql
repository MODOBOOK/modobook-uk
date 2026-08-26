ALTER TABLE public.treatments
  ADD COLUMN IF NOT EXISTS course_unit_label text,
  ADD COLUMN IF NOT EXISTS course_cta_label text;
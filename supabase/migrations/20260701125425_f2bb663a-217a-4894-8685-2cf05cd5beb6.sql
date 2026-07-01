ALTER TABLE public.treatment_categories
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'treatment';

ALTER TABLE public.treatment_categories
  DROP CONSTRAINT IF EXISTS treatment_categories_kind_check;

ALTER TABLE public.treatment_categories
  ADD CONSTRAINT treatment_categories_kind_check CHECK (kind IN ('treatment','package'));

CREATE INDEX IF NOT EXISTS treatment_categories_kind_idx
  ON public.treatment_categories(profile_id, kind);
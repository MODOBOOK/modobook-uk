ALTER TABLE public.pretreatment_templates
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS bullets jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS pretreatment_templates_profile_category_idx
  ON public.pretreatment_templates (profile_id, category);
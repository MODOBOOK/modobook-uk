
CREATE TABLE public.treatment_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.treatment_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT,
  description TEXT,
  icon TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_treatment_categories_profile ON public.treatment_categories(profile_id);
CREATE INDEX idx_treatment_categories_parent ON public.treatment_categories(parent_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.treatment_categories TO authenticated;
GRANT SELECT ON public.treatment_categories TO anon;
GRANT ALL ON public.treatment_categories TO service_role;

ALTER TABLE public.treatment_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Practitioners manage own categories"
  ON public.treatment_categories
  FOR ALL
  TO authenticated
  USING (public.is_profile_owner(profile_id))
  WITH CHECK (public.is_profile_owner(profile_id));

CREATE POLICY "Public can view categories of active clinics"
  ON public.treatment_categories
  FOR SELECT
  TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = treatment_categories.profile_id AND p.active = true
  ));

CREATE TRIGGER trg_treatment_categories_updated_at
  BEFORE UPDATE ON public.treatment_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.treatments
  ADD COLUMN category_id UUID REFERENCES public.treatment_categories(id) ON DELETE SET NULL;

CREATE INDEX idx_treatments_category ON public.treatments(category_id);

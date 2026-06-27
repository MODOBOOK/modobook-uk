
CREATE TABLE public.addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  price_cents integer NOT NULL DEFAULT 0,
  duration_min integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX addons_profile_idx ON public.addons(profile_id);

GRANT SELECT ON public.addons TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.addons TO authenticated;
GRANT ALL ON public.addons TO service_role;

ALTER TABLE public.addons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read addons of active profiles"
  ON public.addons FOR SELECT
  USING (active = true AND public.is_active_profile(profile_id));

CREATE POLICY "Practitioners manage own addons"
  ON public.addons FOR ALL
  USING (public.is_profile_owner(profile_id))
  WITH CHECK (public.is_profile_owner(profile_id));

CREATE TRIGGER trg_addons_updated
  BEFORE UPDATE ON public.addons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.addon_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  addon_id uuid NOT NULL REFERENCES public.addons(id) ON DELETE CASCADE,
  treatment_id uuid REFERENCES public.treatments(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.treatment_categories(id) ON DELETE CASCADE,
  discount_percent numeric(5,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT addon_links_one_target CHECK (
    (treatment_id IS NOT NULL AND category_id IS NULL)
    OR (treatment_id IS NULL AND category_id IS NOT NULL)
  )
);
CREATE UNIQUE INDEX addon_links_unique_treatment ON public.addon_links(addon_id, treatment_id) WHERE treatment_id IS NOT NULL;
CREATE UNIQUE INDEX addon_links_unique_category ON public.addon_links(addon_id, category_id) WHERE category_id IS NOT NULL;
CREATE INDEX addon_links_treatment_idx ON public.addon_links(treatment_id);
CREATE INDEX addon_links_category_idx ON public.addon_links(category_id);

GRANT SELECT ON public.addon_links TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.addon_links TO authenticated;
GRANT ALL ON public.addon_links TO service_role;

ALTER TABLE public.addon_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read links of active addons"
  ON public.addon_links FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.addons a
    WHERE a.id = addon_id AND a.active = true AND public.is_active_profile(a.profile_id)
  ));

CREATE POLICY "Practitioners manage own addon links"
  ON public.addon_links FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.addons a
    WHERE a.id = addon_id AND public.is_profile_owner(a.profile_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.addons a
    WHERE a.id = addon_id AND public.is_profile_owner(a.profile_id)
  ));

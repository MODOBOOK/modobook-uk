CREATE TABLE public.package_builders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Build your own package',
  description text,
  image_url text,
  mode text NOT NULL DEFAULT 'sum',
  discount_percent numeric NOT NULL DEFAULT 0,
  tiers jsonb NOT NULL DEFAULT '[]'::jsonb,
  fixed_price numeric,
  pick_count integer,
  min_items integer NOT NULL DEFAULT 2,
  max_items integer,
  category_id uuid REFERENCES public.treatment_categories(id) ON DELETE SET NULL,
  show_in_packages boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.package_builders TO authenticated;
GRANT SELECT ON public.package_builders TO anon;
GRANT ALL ON public.package_builders TO service_role;

ALTER TABLE public.package_builders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage package builders" ON public.package_builders
  FOR ALL TO authenticated
  USING (public.is_profile_owner(profile_id))
  WITH CHECK (public.is_profile_owner(profile_id));

CREATE POLICY "Public read active package builders" ON public.package_builders
  FOR SELECT TO anon, authenticated
  USING (active = true AND public.is_active_profile(profile_id));

CREATE TABLE public.package_builder_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  builder_id uuid NOT NULL REFERENCES public.package_builders(id) ON DELETE CASCADE,
  treatment_id uuid NOT NULL REFERENCES public.treatments(id) ON DELETE CASCADE,
  max_qty integer NOT NULL DEFAULT 3,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (builder_id, treatment_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.package_builder_items TO authenticated;
GRANT SELECT ON public.package_builder_items TO anon;
GRANT ALL ON public.package_builder_items TO service_role;

ALTER TABLE public.package_builder_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage package builder items" ON public.package_builder_items
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.package_builders b WHERE b.id = builder_id AND public.is_profile_owner(b.profile_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.package_builders b WHERE b.id = builder_id AND public.is_profile_owner(b.profile_id)));

CREATE POLICY "Public read package builder items" ON public.package_builder_items
  FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.package_builders b WHERE b.id = builder_id AND b.active = true AND public.is_active_profile(b.profile_id)));

CREATE TRIGGER update_package_builders_updated_at
  BEFORE UPDATE ON public.package_builders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.packages
  ADD COLUMN IF NOT EXISTS is_custom boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS builder_id uuid REFERENCES public.package_builders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_package_builders_profile ON public.package_builders(profile_id);
CREATE INDEX IF NOT EXISTS idx_package_builder_items_builder ON public.package_builder_items(builder_id);
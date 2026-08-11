CREATE TABLE public.offer_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  subtitle text,
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  pricing_mode text NOT NULL DEFAULT 'none',
  discount_percent numeric,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.offer_groups TO authenticated;
GRANT SELECT ON public.offer_groups TO anon;
GRANT ALL ON public.offer_groups TO service_role;

ALTER TABLE public.offer_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their offer groups"
ON public.offer_groups FOR ALL TO authenticated
USING (public.is_profile_owner(profile_id))
WITH CHECK (public.is_profile_owner(profile_id));

CREATE POLICY "Public can view active offer groups"
ON public.offer_groups FOR SELECT TO anon, authenticated
USING (active = true);

CREATE TABLE public.offer_group_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.offer_groups(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  treatment_id uuid REFERENCES public.treatments(id) ON DELETE CASCADE,
  package_id uuid REFERENCES public.packages(id) ON DELETE CASCADE,
  offer_price numeric,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT offer_group_items_one_target CHECK (num_nonnulls(treatment_id, package_id) = 1)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.offer_group_items TO authenticated;
GRANT SELECT ON public.offer_group_items TO anon;
GRANT ALL ON public.offer_group_items TO service_role;

ALTER TABLE public.offer_group_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their offer group items"
ON public.offer_group_items FOR ALL TO authenticated
USING (public.is_profile_owner(profile_id))
WITH CHECK (public.is_profile_owner(profile_id));

CREATE POLICY "Public can view items of active offer groups"
ON public.offer_group_items FOR SELECT TO anon, authenticated
USING (EXISTS (SELECT 1 FROM public.offer_groups g WHERE g.id = group_id AND g.active = true));

CREATE INDEX offer_groups_profile_idx ON public.offer_groups(profile_id);
CREATE INDEX offer_group_items_group_idx ON public.offer_group_items(group_id);

CREATE TRIGGER update_offer_groups_updated_at
BEFORE UPDATE ON public.offer_groups
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_offer_group_items_updated_at
BEFORE UPDATE ON public.offer_group_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
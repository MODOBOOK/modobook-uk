CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  supplier TEXT,
  unit_cost_cents INTEGER NOT NULL DEFAULT 0,
  pack_size NUMERIC NOT NULL DEFAULT 1,
  stock_units NUMERIC NOT NULL DEFAULT 0,
  low_stock_threshold NUMERIC,
  owner_kind TEXT NOT NULL DEFAULT 'clinic',
  owner_staff_id UUID REFERENCES public.staff_members(id) ON DELETE SET NULL,
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Practitioners manage own products" ON public.products FOR ALL TO authenticated USING (is_profile_owner(profile_id)) WITH CHECK (is_profile_owner(profile_id));
CREATE POLICY "Clinic staff manage products" ON public.products FOR ALL TO authenticated USING (is_clinic_staff(profile_id)) WITH CHECK (is_clinic_staff(profile_id));

CREATE TABLE public.product_purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  purchased_at DATE NOT NULL DEFAULT CURRENT_DATE,
  quantity NUMERIC NOT NULL DEFAULT 1,
  total_cost_cents INTEGER NOT NULL DEFAULT 0,
  supplier TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_purchases TO authenticated;
GRANT ALL ON public.product_purchases TO service_role;
ALTER TABLE public.product_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Practitioners manage own product purchases" ON public.product_purchases FOR ALL TO authenticated USING (is_profile_owner(profile_id)) WITH CHECK (is_profile_owner(profile_id));
CREATE POLICY "Clinic staff manage product purchases" ON public.product_purchases FOR ALL TO authenticated USING (is_clinic_staff(profile_id)) WITH CHECK (is_clinic_staff(profile_id));

CREATE TABLE public.treatment_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  treatment_id UUID NOT NULL REFERENCES public.treatments(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  cost_per_treatment_cents INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (treatment_id, product_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.treatment_products TO authenticated;
GRANT ALL ON public.treatment_products TO service_role;
ALTER TABLE public.treatment_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Practitioners manage own treatment products" ON public.treatment_products FOR ALL TO authenticated USING (is_profile_owner(profile_id)) WITH CHECK (is_profile_owner(profile_id));
CREATE POLICY "Clinic staff manage treatment products" ON public.treatment_products FOR ALL TO authenticated USING (is_clinic_staff(profile_id)) WITH CHECK (is_clinic_staff(profile_id));

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
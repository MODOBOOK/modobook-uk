CREATE TABLE public.business_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'other',
  amount_cents integer NOT NULL DEFAULT 0,
  frequency text NOT NULL DEFAULT 'one_off',
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_expenses TO authenticated;
GRANT ALL ON public.business_expenses TO service_role;
ALTER TABLE public.business_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Clinic staff manage expenses" ON public.business_expenses FOR ALL TO authenticated USING (is_clinic_staff(profile_id)) WITH CHECK (is_clinic_staff(profile_id));
CREATE POLICY "Practitioners manage own expenses" ON public.business_expenses FOR ALL TO authenticated USING (is_profile_owner(profile_id)) WITH CHECK (is_profile_owner(profile_id));
CREATE INDEX business_expenses_profile_idx ON public.business_expenses(profile_id);
CREATE TRIGGER business_expenses_updated_at BEFORE UPDATE ON public.business_expenses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
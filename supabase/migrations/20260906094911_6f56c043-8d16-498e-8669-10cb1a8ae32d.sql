CREATE TABLE public.membership_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price_cents integer NOT NULL CHECK (price_cents >= 100),
  interval text NOT NULL DEFAULT 'month' CHECK (interval IN ('month','year')),
  credit_cents integer NOT NULL DEFAULT 0,
  spend_mode text NOT NULL DEFAULT 'any' CHECK (spend_mode IN ('any','restricted','manual')),
  eligible_treatment_ids uuid[],
  included_treatments jsonb NOT NULL DEFAULT '[]'::jsonb,
  discount_percent numeric(5,2),
  perks text,
  stripe_price_id text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.membership_plans TO authenticated;
GRANT ALL ON public.membership_plans TO service_role;
ALTER TABLE public.membership_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Practitioners manage own plans" ON public.membership_plans FOR ALL TO authenticated
  USING (profile_id = public._profile_id_for_user(auth.uid()))
  WITH CHECK (profile_id = public._profile_id_for_user(auth.uid()));
CREATE POLICY "Patients view active plans" ON public.membership_plans FOR SELECT TO authenticated
  USING (active = true);

CREATE TABLE public.patient_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.membership_plans(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  clinic_client_id uuid REFERENCES public.clinic_clients(id) ON DELETE SET NULL,
  patient_user_id uuid,
  patient_email text,
  patient_name text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','cancelled','past_due')),
  stripe_subscription_id text,
  stripe_customer_id text,
  current_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX patient_memberships_profile_idx ON public.patient_memberships(profile_id, status);
CREATE UNIQUE INDEX patient_memberships_sub_uidx ON public.patient_memberships(stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_memberships TO authenticated;
GRANT ALL ON public.patient_memberships TO service_role;
ALTER TABLE public.patient_memberships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Practitioners manage own memberships" ON public.patient_memberships FOR ALL TO authenticated
  USING (profile_id = public._profile_id_for_user(auth.uid()))
  WITH CHECK (profile_id = public._profile_id_for_user(auth.uid()));
CREATE POLICY "Patients view own memberships" ON public.patient_memberships FOR SELECT TO authenticated
  USING (patient_user_id = auth.uid());
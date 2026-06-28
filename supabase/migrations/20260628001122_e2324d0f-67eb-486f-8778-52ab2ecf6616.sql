
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS contact_sms_number text,
  ADD COLUMN IF NOT EXISTS contact_whatsapp_number text;

DROP FUNCTION IF EXISTS public.get_public_profile_by_slug(text);

CREATE FUNCTION public.get_public_profile_by_slug(p_slug text)
RETURNS TABLE(
  id uuid, slug text, full_name text, clinic_name text, tagline text, about text, bio text,
  avatar_url text, hero_url text, brand_color text, address jsonb, social_links jsonb,
  specialties text[], qualifications jsonb, timeline jsonb,
  welcome_intro_html text, deposit_amount_cents integer, deposit_policy_text text,
  cancellation_rules jsonb, terms_html text, terms_required boolean,
  discount_stack_mode text,
  contact_sms_number text, contact_whatsapp_number text,
  active boolean, created_at timestamptz, updated_at timestamptz
)
LANGUAGE sql SECURITY DEFINER SET search_path = 'public'
AS $$
  SELECT
    id, slug, full_name, clinic_name, tagline, about, bio, avatar_url, hero_url,
    brand_color, address, social_links, specialties, qualifications, timeline,
    welcome_intro_html, deposit_amount_cents, deposit_policy_text, cancellation_rules,
    terms_html, terms_required, discount_stack_mode,
    contact_sms_number, contact_whatsapp_number,
    active, created_at, updated_at
  FROM public.profiles
  WHERE slug = p_slug AND active = true;
$$;
REVOKE EXECUTE ON FUNCTION public.get_public_profile_by_slug(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_profile_by_slug(text) TO anon, authenticated;

CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  currency text NOT NULL DEFAULT 'gbp',
  interval text NOT NULL DEFAULT 'month' CHECK (interval IN ('month','year')),
  stripe_price_id text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subscription_plans TO authenticated;
GRANT ALL ON public.subscription_plans TO service_role;
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage plans" ON public.subscription_plans
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Authenticated can read active plans" ON public.subscription_plans
  FOR SELECT TO authenticated USING (active = true);

CREATE TABLE IF NOT EXISTS public.practitioner_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','active','past_due','canceled','incomplete','trialing','paused')),
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (profile_id)
);
GRANT SELECT ON public.practitioner_subscriptions TO authenticated;
GRANT ALL ON public.practitioner_subscriptions TO service_role;
ALTER TABLE public.practitioner_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage subscriptions" ON public.practitioner_subscriptions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Owner reads own subscription" ON public.practitioner_subscriptions
  FOR SELECT TO authenticated USING (public.is_profile_owner(profile_id));

DROP TRIGGER IF EXISTS trg_subscription_plans_updated_at ON public.subscription_plans;
CREATE TRIGGER trg_subscription_plans_updated_at BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_practitioner_subscriptions_updated_at ON public.practitioner_subscriptions;
CREATE TRIGGER trg_practitioner_subscriptions_updated_at BEFORE UPDATE ON public.practitioner_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

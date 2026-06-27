
-- 1. blocked_times (timed, single-day blocks on calendar)
CREATE TABLE public.blocked_times (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  location_id uuid REFERENCES public.locations(id) ON DELETE CASCADE,
  date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blocked_times TO authenticated;
GRANT SELECT ON public.blocked_times TO anon;
GRANT ALL ON public.blocked_times TO service_role;
ALTER TABLE public.blocked_times ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage blocked times" ON public.blocked_times
  FOR ALL TO authenticated
  USING (public.is_profile_owner(profile_id))
  WITH CHECK (public.is_profile_owner(profile_id));
CREATE POLICY "Public read blocked times for active clinics" ON public.blocked_times
  FOR SELECT TO anon, authenticated
  USING (public.is_active_profile(profile_id));
CREATE TRIGGER update_blocked_times_updated_at BEFORE UPDATE ON public.blocked_times
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_blocked_times_profile_date ON public.blocked_times(profile_id, date);

-- 2. payment_links (Stripe Payment Links created on practitioner's connect account)
CREATE TABLE public.payment_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'adhoc', -- 'adhoc' | 'deposit' | 'checkout'
  description text,
  amount_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'gbp',
  stripe_payment_link_id text,
  stripe_url text,
  status text NOT NULL DEFAULT 'open', -- open | paid | cancelled | expired
  expires_at timestamptz,
  paid_at timestamptz,
  recipient_email text,
  recipient_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_links TO authenticated;
GRANT ALL ON public.payment_links TO service_role;
ALTER TABLE public.payment_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage payment links" ON public.payment_links
  FOR ALL TO authenticated
  USING (public.is_profile_owner(profile_id))
  WITH CHECK (public.is_profile_owner(profile_id));
CREATE TRIGGER update_payment_links_updated_at BEFORE UPDATE ON public.payment_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_payment_links_profile ON public.payment_links(profile_id, created_at DESC);
CREATE INDEX idx_payment_links_appt ON public.payment_links(appointment_id);

-- 3. appointments: deposit + checkout columns
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS deposit_required_cents integer,
  ADD COLUMN IF NOT EXISTS deposit_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS deposit_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS deposit_payment_link_id uuid REFERENCES public.payment_links(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS checkout_notes text,
  ADD COLUMN IF NOT EXISTS checkout_discount_cents integer,
  ADD COLUMN IF NOT EXISTS checkout_method text,
  ADD COLUMN IF NOT EXISTS checkout_completed_at timestamptz;

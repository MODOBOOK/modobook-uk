
-- Gift card product definitions per practitioner
CREATE TABLE public.gift_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  kind text NOT NULL CHECK (kind IN ('value', 'treatment', 'package')),
  amount numeric(10,2),
  treatment_id uuid REFERENCES public.treatments(id) ON DELETE SET NULL,
  package_id uuid REFERENCES public.packages(id) ON DELETE SET NULL,
  image_url text,
  expires_months integer,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.gift_cards TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gift_cards TO authenticated;
GRANT ALL ON public.gift_cards TO service_role;
ALTER TABLE public.gift_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active gift cards"
  ON public.gift_cards FOR SELECT TO anon, authenticated
  USING (active = true);
CREATE POLICY "Owner manages own gift cards"
  ON public.gift_cards FOR ALL TO authenticated
  USING (auth.uid() = profile_id) WITH CHECK (auth.uid() = profile_id);

CREATE INDEX gift_cards_profile_id_idx ON public.gift_cards(profile_id);

-- Individual gift card purchases (each has a unique redemption code)
CREATE TABLE public.gift_card_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL,
  gift_card_id uuid REFERENCES public.gift_cards(id) ON DELETE SET NULL,
  code text NOT NULL UNIQUE,
  kind text NOT NULL CHECK (kind IN ('value', 'treatment', 'package')),
  treatment_id uuid,
  package_id uuid,
  initial_amount numeric(10,2) NOT NULL,
  remaining_amount numeric(10,2) NOT NULL,
  buyer_name text,
  buyer_email text,
  recipient_name text,
  recipient_email text,
  message text,
  delivery text NOT NULL DEFAULT 'buyer' CHECK (delivery IN ('buyer', 'recipient')),
  expires_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'redeemed', 'expired', 'cancelled')),
  stripe_session_id text,
  stripe_payment_intent_id text,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gift_card_purchases TO authenticated;
GRANT ALL ON public.gift_card_purchases TO service_role;
ALTER TABLE public.gift_card_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner sees own gift card purchases"
  ON public.gift_card_purchases FOR SELECT TO authenticated
  USING (auth.uid() = profile_id);
CREATE POLICY "Owner manages own gift card purchases"
  ON public.gift_card_purchases FOR ALL TO authenticated
  USING (auth.uid() = profile_id) WITH CHECK (auth.uid() = profile_id);

CREATE INDEX gift_card_purchases_profile_id_idx ON public.gift_card_purchases(profile_id);
CREATE INDEX gift_card_purchases_code_idx ON public.gift_card_purchases(code);

-- Redemption audit log
CREATE TABLE public.gift_card_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES public.gift_card_purchases(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL,
  appointment_id uuid,
  amount numeric(10,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.gift_card_redemptions TO authenticated;
GRANT ALL ON public.gift_card_redemptions TO service_role;
ALTER TABLE public.gift_card_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner sees own gift card redemptions"
  ON public.gift_card_redemptions FOR SELECT TO authenticated
  USING (auth.uid() = profile_id);

CREATE INDEX gift_card_redemptions_purchase_id_idx ON public.gift_card_redemptions(purchase_id);

-- Reuse existing update trigger
CREATE TRIGGER gift_cards_updated_at BEFORE UPDATE ON public.gift_cards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER gift_card_purchases_updated_at BEFORE UPDATE ON public.gift_card_purchases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

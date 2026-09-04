-- 1. Referral codes owned by practitioners -----------------------------------
CREATE TABLE public.practitioner_referral_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_profile_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  discount_code_id uuid REFERENCES public.platform_discount_codes(id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.practitioner_referral_codes TO authenticated;
GRANT ALL ON public.practitioner_referral_codes TO service_role;
ALTER TABLE public.practitioner_referral_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their referral code"
ON public.practitioner_referral_codes FOR SELECT TO authenticated
USING (owner_profile_id = public._profile_id_for_user(auth.uid()));

-- 2. Signups made with a referral code ---------------------------------------
CREATE TABLE public.practitioner_referral_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code_id uuid NOT NULL REFERENCES public.practitioner_referral_codes(id) ON DELETE CASCADE,
  referred_profile_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  qualified_at timestamptz,
  reward_granted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.practitioner_referral_signups TO authenticated;
GRANT ALL ON public.practitioner_referral_signups TO service_role;
ALTER TABLE public.practitioner_referral_signups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Referrer can view their referral signups"
ON public.practitioner_referral_signups FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.practitioner_referral_codes c
    WHERE c.id = referral_code_id
      AND c.owner_profile_id = public._profile_id_for_user(auth.uid())
  )
);

CREATE POLICY "Referred practitioner can view their own signup"
ON public.practitioner_referral_signups FOR SELECT TO authenticated
USING (referred_profile_id = public._profile_id_for_user(auth.uid()));

-- 3. Banked reward months on the referrer's subscription ----------------------
ALTER TABLE public.practitioner_subscriptions
  ADD COLUMN IF NOT EXISTS referral_reward_months_remaining integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS referral_reward_months_earned integer NOT NULL DEFAULT 0;

-- 4. Create (or fetch) a practitioner's referral code -------------------------
CREATE OR REPLACE FUNCTION public.ensure_practitioner_referral_code(_profile_id uuid)
RETURNS TABLE(code text, discount_code_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.practitioner_referral_codes%ROWTYPE;
  v_base text;
  v_code text;
  v_try int := 0;
  v_dc uuid;
BEGIN
  SELECT * INTO v_existing FROM public.practitioner_referral_codes WHERE owner_profile_id = _profile_id;
  IF FOUND THEN
    RETURN QUERY SELECT v_existing.code, v_existing.discount_code_id;
    RETURN;
  END IF;

  SELECT upper(regexp_replace(coalesce(p.slug, p.clinic_name, 'modo'), '[^a-zA-Z0-9]', '', 'g'))
    INTO v_base FROM public.profiles p WHERE p.id = _profile_id;
  v_base := left(coalesce(nullif(v_base, ''), 'MODO'), 10);
  v_code := v_base || '25';

  WHILE EXISTS (SELECT 1 FROM public.platform_discount_codes d WHERE upper(d.code) = upper(v_code))
     OR EXISTS (SELECT 1 FROM public.practitioner_referral_codes r WHERE upper(r.code) = upper(v_code)) LOOP
    v_try := v_try + 1;
    v_code := v_base || '25' || v_try::text;
  END LOOP;

  INSERT INTO public.platform_discount_codes
    (code, description, percent_off, duration, duration_in_months, active)
  VALUES
    (v_code, 'Practitioner referral — 25% off for 3 months', 25, 'repeating', 3, true)
  RETURNING id INTO v_dc;

  INSERT INTO public.practitioner_referral_codes (owner_profile_id, code, discount_code_id)
  VALUES (_profile_id, v_code, v_dc);

  RETURN QUERY SELECT v_code, v_dc;
END;
$$;

-- 5. Record that a new practitioner joined with a referral code ---------------
CREATE OR REPLACE FUNCTION public.record_practitioner_referral(_referred_profile_id uuid, _discount_code_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code_id uuid;
  v_owner uuid;
BEGIN
  SELECT id, owner_profile_id INTO v_code_id, v_owner
  FROM public.practitioner_referral_codes
  WHERE discount_code_id = _discount_code_id AND active;

  IF v_code_id IS NULL OR v_owner = _referred_profile_id THEN
    RETURN false;
  END IF;

  INSERT INTO public.practitioner_referral_signups (referral_code_id, referred_profile_id)
  VALUES (v_code_id, _referred_profile_id)
  ON CONFLICT (referred_profile_id) DO NOTHING;

  RETURN true;
END;
$$;

-- 6. Mark a referral successful once the new practitioner starts paying -------
CREATE OR REPLACE FUNCTION public.qualify_practitioner_referral(_referred_profile_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_signup public.practitioner_referral_signups%ROWTYPE;
  v_owner uuid;
BEGIN
  SELECT * INTO v_signup FROM public.practitioner_referral_signups
  WHERE referred_profile_id = _referred_profile_id AND reward_granted_at IS NULL;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  SELECT owner_profile_id INTO v_owner FROM public.practitioner_referral_codes WHERE id = v_signup.referral_code_id;
  IF v_owner IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.practitioner_referral_signups
  SET status = 'qualified', qualified_at = now(), reward_granted_at = now(), updated_at = now()
  WHERE id = v_signup.id;

  INSERT INTO public.practitioner_subscriptions (profile_id, status, referral_reward_months_remaining, referral_reward_months_earned)
  VALUES (v_owner, 'trialing', 1, 1)
  ON CONFLICT (profile_id) DO UPDATE
  SET referral_reward_months_remaining = public.practitioner_subscriptions.referral_reward_months_remaining + 1,
      referral_reward_months_earned = public.practitioner_subscriptions.referral_reward_months_earned + 1;

  RETURN true;
END;
$$;
-- 1. Add 'prescriber' to app_role enum
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'prescriber'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'app_role')
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'prescriber';
  END IF;
END$$;

-- Drop pre-existing helper functions in case prior partial run created them with different signatures
DROP FUNCTION IF EXISTS public.resolve_hub_code(TEXT);
DROP FUNCTION IF EXISTS public.ensure_hub_code(TEXT, TEXT);

-- 2. prescriber_profiles
CREATE TABLE IF NOT EXISTS public.prescriber_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  regulatory_body TEXT NOT NULL,
  regulatory_body_other TEXT,
  registration_number TEXT NOT NULL,
  id_document_path TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','more_info')),
  admin_note TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prescriber_profiles TO authenticated;
GRANT ALL ON public.prescriber_profiles TO service_role;

ALTER TABLE public.prescriber_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "prescriber_self_select" ON public.prescriber_profiles;
CREATE POLICY "prescriber_self_select" ON public.prescriber_profiles
  FOR SELECT USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "prescriber_self_insert" ON public.prescriber_profiles;
CREATE POLICY "prescriber_self_insert" ON public.prescriber_profiles
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "prescriber_self_update" ON public.prescriber_profiles;
CREATE POLICY "prescriber_self_update" ON public.prescriber_profiles
  FOR UPDATE USING (
    (user_id = auth.uid() AND status IN ('pending','more_info','rejected'))
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE OR REPLACE FUNCTION public.update_prescriber_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_prescriber_profiles_updated_at ON public.prescriber_profiles;
CREATE TRIGGER trg_prescriber_profiles_updated_at
  BEFORE UPDATE ON public.prescriber_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_prescriber_profiles_updated_at();

-- 3. hub_codes
CREATE TABLE IF NOT EXISTS public.hub_codes (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  owner_kind TEXT NOT NULL CHECK (owner_kind IN ('practitioner','prescriber')),
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hub_codes TO authenticated;
GRANT ALL ON public.hub_codes TO service_role;

ALTER TABLE public.hub_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hub_codes_read_auth" ON public.hub_codes;
CREATE POLICY "hub_codes_read_auth" ON public.hub_codes
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "hub_codes_self_write" ON public.hub_codes;
CREATE POLICY "hub_codes_self_write" ON public.hub_codes
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.ensure_hub_code(p_kind TEXT, p_display_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_code TEXT;
  v_alphabet TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i INT;
  attempt INT := 0;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT code INTO v_code FROM public.hub_codes WHERE user_id = v_user;
  IF v_code IS NOT NULL THEN
    UPDATE public.hub_codes
      SET display_name = COALESCE(p_display_name, display_name),
          owner_kind = p_kind
      WHERE user_id = v_user;
    RETURN v_code;
  END IF;
  LOOP
    attempt := attempt + 1;
    v_code := '';
    FOR i IN 1..6 LOOP
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    END LOOP;
    BEGIN
      INSERT INTO public.hub_codes (user_id, code, owner_kind, display_name)
        VALUES (v_user, v_code, p_kind, p_display_name);
      RETURN v_code;
    EXCEPTION WHEN unique_violation THEN
      IF attempt > 20 THEN RAISE; END IF;
    END;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_hub_code(TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.resolve_hub_code(p_code TEXT)
RETURNS TABLE(user_id UUID, owner_kind TEXT, display_name TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT hc.user_id, hc.owner_kind, hc.display_name
  FROM public.hub_codes hc
  WHERE hc.code = upper(regexp_replace(p_code, '[^A-Za-z0-9]', '', 'g'))
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_hub_code(TEXT) TO authenticated;

-- 4. hub_links
CREATE TABLE IF NOT EXISTS public.hub_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','cancelled')),
  requester_note TEXT,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (requester_user_id <> recipient_user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS hub_links_pair_uidx
  ON public.hub_links (
    LEAST(requester_user_id, recipient_user_id),
    GREATEST(requester_user_id, recipient_user_id)
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hub_links TO authenticated;
GRANT ALL ON public.hub_links TO service_role;

ALTER TABLE public.hub_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hub_links_party_select" ON public.hub_links;
CREATE POLICY "hub_links_party_select" ON public.hub_links
  FOR SELECT USING (
    auth.uid() IN (requester_user_id, recipient_user_id)
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "hub_links_requester_insert" ON public.hub_links;
CREATE POLICY "hub_links_requester_insert" ON public.hub_links
  FOR INSERT WITH CHECK (requester_user_id = auth.uid());

DROP POLICY IF EXISTS "hub_links_recipient_update" ON public.hub_links;
CREATE POLICY "hub_links_recipient_update" ON public.hub_links
  FOR UPDATE USING (recipient_user_id = auth.uid())
  WITH CHECK (recipient_user_id = auth.uid());

DROP POLICY IF EXISTS "hub_links_party_delete" ON public.hub_links;
CREATE POLICY "hub_links_party_delete" ON public.hub_links
  FOR DELETE USING (auth.uid() IN (requester_user_id, recipient_user_id));
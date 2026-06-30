
-- 1. Extend app_role
DO $$ BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'prescriber';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Enums for hub
DO $$ BEGIN
  CREATE TYPE public.prescriber_status AS ENUM ('pending','approved','rejected','more_info');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.hub_owner_kind AS ENUM ('practitioner','prescriber');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.hub_link_status AS ENUM ('pending','accepted','declined','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Prescriber verification submissions
CREATE TABLE IF NOT EXISTS public.prescriber_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  regulatory_body text NOT NULL,
  regulatory_body_other text,
  registration_number text NOT NULL,
  id_document_path text,
  status public.prescriber_status NOT NULL DEFAULT 'pending',
  admin_note text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prescriber_profiles TO authenticated;
GRANT ALL ON public.prescriber_profiles TO service_role;

ALTER TABLE public.prescriber_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Prescriber can read own verification"
  ON public.prescriber_profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Prescriber can insert own verification"
  ON public.prescriber_profiles FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Prescriber can update own pending/more_info"
  ON public.prescriber_profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND status IN ('pending','more_info'))
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admin can update any verification"
  ON public.prescriber_profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER prescriber_profiles_updated_at
  BEFORE UPDATE ON public.prescriber_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Hub codes — one per user
CREATE TABLE IF NOT EXISTS public.hub_codes (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_kind public.hub_owner_kind NOT NULL,
  code text NOT NULL UNIQUE,
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.hub_codes TO authenticated;
GRANT ALL ON public.hub_codes TO service_role;

ALTER TABLE public.hub_codes ENABLE ROW LEVEL SECURITY;

-- Authenticated users may look up codes (so they can resolve someone else's code).
-- Codes are not sensitive; they're meant to be shared.
CREATE POLICY "Authenticated can read hub codes"
  ON public.hub_codes FOR SELECT TO authenticated USING (true);

CREATE POLICY "User manages own hub code"
  ON public.hub_codes FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 5. Hub link requests
CREATE TABLE IF NOT EXISTS public.hub_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.hub_link_status NOT NULL DEFAULT 'pending',
  requester_note text,
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT hub_links_not_self CHECK (requester_user_id <> recipient_user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS hub_links_unique_pair
  ON public.hub_links (
    LEAST(requester_user_id, recipient_user_id),
    GREATEST(requester_user_id, recipient_user_id)
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.hub_links TO authenticated;
GRANT ALL ON public.hub_links TO service_role;

ALTER TABLE public.hub_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Either party can read link"
  ON public.hub_links FOR SELECT TO authenticated
  USING (requester_user_id = auth.uid() OR recipient_user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "Requester can create link"
  ON public.hub_links FOR INSERT TO authenticated
  WITH CHECK (requester_user_id = auth.uid());

CREATE POLICY "Either party can update link"
  ON public.hub_links FOR UPDATE TO authenticated
  USING (requester_user_id = auth.uid() OR recipient_user_id = auth.uid())
  WITH CHECK (requester_user_id = auth.uid() OR recipient_user_id = auth.uid());

CREATE POLICY "Either party can delete link"
  ON public.hub_links FOR DELETE TO authenticated
  USING (requester_user_id = auth.uid() OR recipient_user_id = auth.uid());

CREATE TRIGGER hub_links_updated_at
  BEFORE UPDATE ON public.hub_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Helper functions
CREATE OR REPLACE FUNCTION public.is_prescriber_approved(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.prescriber_profiles WHERE user_id = _user_id AND status = 'approved');
$$;

CREATE OR REPLACE FUNCTION public.ensure_hub_code(p_kind public.hub_owner_kind, p_display_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_existing text;
  v_attempt int := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT code INTO v_existing FROM public.hub_codes WHERE user_id = auth.uid();
  IF v_existing IS NOT NULL THEN RETURN v_existing; END IF;

  LOOP
    v_attempt := v_attempt + 1;
    -- 6-char code: MODO-XXXX style stored as MODOXXXX (no dash) so codes are easy to compare
    v_code := upper(
      'MODO' || substring(translate(encode(gen_random_bytes(4), 'base64'),'+/=','XYZ'), 1, 4)
    );
    BEGIN
      INSERT INTO public.hub_codes (user_id, owner_kind, code, display_name)
      VALUES (auth.uid(), p_kind, v_code, p_display_name);
      RETURN v_code;
    EXCEPTION WHEN unique_violation THEN
      IF v_attempt > 8 THEN RAISE; END IF;
    END;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_hub_code(p_code text)
RETURNS TABLE(user_id uuid, owner_kind public.hub_owner_kind, display_name text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id, owner_kind, display_name
  FROM public.hub_codes
  WHERE upper(replace(code,'-','')) = upper(replace(p_code,'-',''))
  LIMIT 1;
$$;

-- 7. Storage bucket (private) for prescriber IDs is created via the storage tool

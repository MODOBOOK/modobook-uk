
-- Staff members & permissions system
CREATE TYPE public.staff_role AS ENUM ('admin', 'practitioner', 'receptionist', 'viewer');
CREATE TYPE public.staff_scope AS ENUM ('clinic', 'own');
CREATE TYPE public.staff_status AS ENUM ('invited', 'active', 'disabled');

CREATE TABLE public.staff_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_email TEXT NOT NULL,
  name TEXT NOT NULL,
  role public.staff_role NOT NULL,
  data_scope public.staff_scope NOT NULL DEFAULT 'clinic',
  practitioner_id UUID REFERENCES public.practitioners(id) ON DELETE SET NULL,
  status public.staff_status NOT NULL DEFAULT 'invited',
  invite_token TEXT UNIQUE,
  invite_expires_at TIMESTAMPTZ,
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  last_active_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (profile_id, invited_email)
);

CREATE INDEX idx_staff_members_profile ON public.staff_members(profile_id);
CREATE INDEX idx_staff_members_user ON public.staff_members(user_id);
CREATE INDEX idx_staff_members_token ON public.staff_members(invite_token);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_members TO authenticated;
GRANT ALL ON public.staff_members TO service_role;

ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;

-- Helper: is caller the owner of the given clinic profile?
CREATE OR REPLACE FUNCTION public.is_clinic_owner(_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.profiles
    WHERE id = _profile_id AND user_id = auth.uid()
  );
$$;

-- Helper: is caller an active staff member of the given clinic (any role)?
CREATE OR REPLACE FUNCTION public.is_clinic_staff(_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.staff_members
    WHERE profile_id = _profile_id
      AND user_id = auth.uid()
      AND status = 'active'
  );
$$;

-- Helper: is caller owner OR active staff of the clinic?
CREATE OR REPLACE FUNCTION public.is_clinic_member(_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.is_clinic_owner(_profile_id) OR public.is_clinic_staff(_profile_id);
$$;

-- Helper: does caller have a specific staff role in the clinic (owner is treated as admin)?
CREATE OR REPLACE FUNCTION public.has_clinic_role(_profile_id UUID, _role public.staff_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    (_role = 'admin' AND public.is_clinic_owner(_profile_id))
    OR EXISTS(
      SELECT 1 FROM public.staff_members
      WHERE profile_id = _profile_id
        AND user_id = auth.uid()
        AND status = 'active'
        AND role = _role
    );
$$;

-- Helper: which clinic profile(s) does the current user belong to (as owner or staff)?
CREATE OR REPLACE FUNCTION public.my_clinic_profile_id()
RETURNS UUID
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT id FROM public.profiles WHERE user_id = auth.uid()
  UNION
  SELECT profile_id FROM public.staff_members WHERE user_id = auth.uid() AND status = 'active'
  LIMIT 1;
$$;

-- RLS on staff_members: clinic owner manages, staff can read own row
CREATE POLICY "Owner manages staff"
  ON public.staff_members
  FOR ALL
  USING (public.is_clinic_owner(profile_id))
  WITH CHECK (public.is_clinic_owner(profile_id));

CREATE POLICY "Staff can read their own row"
  ON public.staff_members
  FOR SELECT
  USING (user_id = auth.uid());

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_staff_members_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_staff_members_updated_at
BEFORE UPDATE ON public.staff_members
FOR EACH ROW EXECUTE FUNCTION public.tg_staff_members_updated_at();

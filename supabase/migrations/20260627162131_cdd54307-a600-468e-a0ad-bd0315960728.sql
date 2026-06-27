
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin','practitioner');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

DROP POLICY IF EXISTS "users read own roles" ON public.user_roles;
CREATE POLICY "users read own roles" ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admins manage roles" ON public.user_roles;
CREATE POLICY "admins manage roles" ON public.user_roles FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.user_roles (user_id, role)
VALUES ('cd2b0d64-c149-4f22-ad1b-83bf41ecdb3f', 'admin')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.admin_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_invites TO authenticated;
GRANT ALL ON public.admin_invites TO service_role;
ALTER TABLE public.admin_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins manage invites" ON public.admin_invites;
CREATE POLICY "admins manage invites" ON public.admin_invites FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.grant_admin_if_invited()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.admin_invites WHERE lower(email)=lower(NEW.email) AND accepted_at IS NULL) THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
    UPDATE public.admin_invites SET accepted_at = now() WHERE lower(email)=lower(NEW.email);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_auth_user_created_admin ON auth.users;
CREATE TRIGGER on_auth_user_created_admin
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.grant_admin_if_invited();

CREATE OR REPLACE FUNCTION public.admin_list_practitioners()
RETURNS TABLE (profile_id uuid, user_id uuid, email text, full_name text, clinic_name text, slug text, active boolean, created_at timestamptz, appointments_count bigint, treatments_count bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  RETURN QUERY
    SELECT p.id, p.user_id, u.email::text, p.full_name, p.clinic_name, p.slug, p.active, p.created_at,
      (SELECT count(*) FROM public.appointments a WHERE a.profile_id=p.id),
      (SELECT count(*) FROM public.treatments t WHERE t.profile_id=p.id)
    FROM public.profiles p LEFT JOIN auth.users u ON u.id=p.user_id
    ORDER BY p.created_at DESC;
END; $$;
REVOKE EXECUTE ON FUNCTION public.admin_list_practitioners() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_practitioners() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_admins()
RETURNS TABLE (user_id uuid, email text, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  RETURN QUERY SELECT ur.user_id, u.email::text, ur.created_at
    FROM public.user_roles ur JOIN auth.users u ON u.id=ur.user_id
    WHERE ur.role='admin' ORDER BY ur.created_at;
END; $$;
REVOKE EXECUTE ON FUNCTION public.admin_list_admins() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_admins() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_revoke_admin(_user_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF _user_id = auth.uid() THEN RAISE EXCEPTION 'Cannot revoke yourself'; END IF;
  DELETE FROM public.user_roles WHERE user_id=_user_id AND role='admin';
  RETURN true;
END; $$;
REVOKE EXECUTE ON FUNCTION public.admin_revoke_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_revoke_admin(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_grant_admin_by_email(_email text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user_id uuid;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT id INTO v_user_id FROM auth.users WHERE lower(email)=lower(_email) LIMIT 1;
  IF v_user_id IS NULL THEN
    INSERT INTO public.admin_invites (email, invited_by) VALUES (lower(_email), auth.uid())
    ON CONFLICT (email) DO UPDATE SET accepted_at=NULL, invited_by=auth.uid();
    RETURN 'invited';
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (v_user_id, 'admin') ON CONFLICT DO NOTHING;
  RETURN 'granted';
END; $$;
REVOKE EXECUTE ON FUNCTION public.admin_grant_admin_by_email(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_grant_admin_by_email(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_invites()
RETURNS TABLE (id uuid, email text, accepted_at timestamptz, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  RETURN QUERY SELECT ai.id, ai.email, ai.accepted_at, ai.created_at
    FROM public.admin_invites ai ORDER BY ai.created_at DESC;
END; $$;
REVOKE EXECUTE ON FUNCTION public.admin_list_invites() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_invites() TO authenticated;

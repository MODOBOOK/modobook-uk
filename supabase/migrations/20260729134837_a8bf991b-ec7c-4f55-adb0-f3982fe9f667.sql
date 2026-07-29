CREATE OR REPLACE FUNCTION public.is_demo_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT p.is_demo FROM public.profiles p WHERE p.user_id = auth.uid() LIMIT 1), false)
$$;

GRANT EXECUTE ON FUNCTION public.is_demo_user() TO authenticated, anon;

CREATE POLICY "demo_no_file_inserts" ON public.client_files
AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (NOT public.is_demo_user());

CREATE POLICY "demo_no_gallery_inserts" ON public.clinic_gallery
AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (NOT public.is_demo_user());

CREATE POLICY "demo_no_gallery_updates" ON public.clinic_gallery
AS RESTRICTIVE FOR UPDATE TO authenticated
USING (NOT public.is_demo_user());

CREATE POLICY "demo_no_new_clients" ON public.clinic_clients
AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (NOT public.is_demo_user());
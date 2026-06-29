ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS about_page jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.get_about_page_by_slug(p_slug text)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(about_page, '{}'::jsonb)
  FROM public.profiles
  WHERE slug = p_slug AND active = true
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_about_page_by_slug(text) TO anon, authenticated, service_role;
CREATE TABLE public.training_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  eyebrow text,
  headline text,
  intro text,
  hero_image_url text,
  courses_heading text,
  highlights jsonb NOT NULL DEFAULT '[]'::jsonb,
  body_heading text,
  body_html text,
  show_highlights boolean NOT NULL DEFAULT true,
  show_cta boolean NOT NULL DEFAULT true,
  cta_heading text,
  cta_body text,
  cta_button_label text,
  cta_url text,
  seo_title text,
  seo_description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.training_pages TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_pages TO authenticated;
GRANT ALL ON public.training_pages TO service_role;

ALTER TABLE public.training_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Training page content is public"
ON public.training_pages FOR SELECT
USING (true);

CREATE POLICY "Owners manage their training page"
ON public.training_pages FOR ALL
TO authenticated
USING (profile_id = public._profile_id_for_user(auth.uid()))
WITH CHECK (profile_id = public._profile_id_for_user(auth.uid()));

CREATE TRIGGER update_training_pages_updated_at
BEFORE UPDATE ON public.training_pages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
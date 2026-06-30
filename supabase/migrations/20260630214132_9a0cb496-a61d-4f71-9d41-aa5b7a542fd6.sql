
CREATE TABLE public.pretreatment_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  summary text,
  body_html text NOT NULL DEFAULT '',
  sort_order int NOT NULL DEFAULT 0,
  show_on_public boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pretreatment_templates TO authenticated;
GRANT SELECT ON public.pretreatment_templates TO anon;
GRANT ALL ON public.pretreatment_templates TO service_role;

ALTER TABLE public.pretreatment_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their pretreatment templates"
  ON public.pretreatment_templates
  FOR ALL
  TO authenticated
  USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
  WITH CHECK (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Public can read published pretreatment templates"
  ON public.pretreatment_templates
  FOR SELECT
  TO anon, authenticated
  USING (show_on_public = true AND active = true);

CREATE TRIGGER update_pretreatment_templates_updated_at
  BEFORE UPDATE ON public.pretreatment_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX pretreatment_templates_profile_idx ON public.pretreatment_templates(profile_id, sort_order);

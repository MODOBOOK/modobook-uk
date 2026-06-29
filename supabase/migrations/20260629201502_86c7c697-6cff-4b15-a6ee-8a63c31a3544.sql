
ALTER TABLE public.aftercare_templates ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false;
ALTER TABLE public.aftercare_templates ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.aftercare_templates ADD COLUMN IF NOT EXISTS summary text;
ALTER TABLE public.aftercare_templates ALTER COLUMN profile_id DROP NOT NULL;

-- Allow everyone authenticated to read system templates
DROP POLICY IF EXISTS "Read system aftercare templates" ON public.aftercare_templates;
CREATE POLICY "Read system aftercare templates" ON public.aftercare_templates
  FOR SELECT TO authenticated USING (is_system = true);

-- Admin manage system templates
DROP POLICY IF EXISTS "Admin manage system aftercare" ON public.aftercare_templates;
CREATE POLICY "Admin manage system aftercare" ON public.aftercare_templates
  FOR ALL TO authenticated
  USING (is_system = true AND public.has_role(auth.uid(),'admin'))
  WITH CHECK (is_system = true AND public.has_role(auth.uid(),'admin'));

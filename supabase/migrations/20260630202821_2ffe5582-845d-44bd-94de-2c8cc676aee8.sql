
ALTER TABLE public.aftercare_templates ADD COLUMN IF NOT EXISTS show_on_public boolean NOT NULL DEFAULT false;
GRANT SELECT ON public.aftercare_templates TO anon;
CREATE POLICY "Public read of public aftercare" ON public.aftercare_templates FOR SELECT TO anon USING (show_on_public = true);

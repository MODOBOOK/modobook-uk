-- ============ CLINIC THEME ============
CREATE TABLE public.clinic_theme (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  primary_color text NOT NULL DEFAULT '#0f172a',
  accent_color text NOT NULL DEFAULT '#d4af37',
  background_color text NOT NULL DEFAULT '#ffffff',
  text_color text NOT NULL DEFAULT '#0f172a',
  header_bg_color text NOT NULL DEFAULT '#ffffff',
  header_text_color text NOT NULL DEFAULT '#0f172a',
  footer_bg_color text NOT NULL DEFAULT '#0f172a',
  footer_text_color text NOT NULL DEFAULT '#ffffff',
  heading_font text NOT NULL DEFAULT 'Inter',
  body_font text NOT NULL DEFAULT 'Inter',
  logo_url text,
  favicon_url text,
  hero_image_url text,
  hero_heading text,
  hero_subheading text,
  custom_css text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.clinic_theme TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clinic_theme TO authenticated;
GRANT ALL ON public.clinic_theme TO service_role;

ALTER TABLE public.clinic_theme ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view themes of active profiles"
  ON public.clinic_theme FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = clinic_theme.profile_id AND p.active = true));

CREATE POLICY "Owners manage their theme"
  ON public.clinic_theme FOR ALL
  USING (public.is_profile_owner(profile_id))
  WITH CHECK (public.is_profile_owner(profile_id));

CREATE TRIGGER update_clinic_theme_updated_at
  BEFORE UPDATE ON public.clinic_theme
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ MEDICAL FORM TEMPLATES ============
CREATE TABLE public.medical_form_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE, -- NULL = system template
  name text NOT NULL,
  description text,
  schema jsonb NOT NULL DEFAULT '[]'::jsonb, -- array of question groups
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.medical_form_templates TO authenticated;
GRANT ALL ON public.medical_form_templates TO service_role;

ALTER TABLE public.medical_form_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Practitioners read system or their own medical templates"
  ON public.medical_form_templates FOR SELECT TO authenticated
  USING (is_system = true OR (profile_id IS NOT NULL AND public.is_profile_owner(profile_id)));

CREATE POLICY "Practitioners insert their own medical templates"
  ON public.medical_form_templates FOR INSERT TO authenticated
  WITH CHECK (is_system = false AND profile_id IS NOT NULL AND public.is_profile_owner(profile_id));

CREATE POLICY "Practitioners update their own medical templates"
  ON public.medical_form_templates FOR UPDATE TO authenticated
  USING (is_system = false AND profile_id IS NOT NULL AND public.is_profile_owner(profile_id))
  WITH CHECK (is_system = false AND profile_id IS NOT NULL AND public.is_profile_owner(profile_id));

CREATE POLICY "Practitioners delete their own medical templates"
  ON public.medical_form_templates FOR DELETE TO authenticated
  USING (is_system = false AND profile_id IS NOT NULL AND public.is_profile_owner(profile_id));

CREATE TRIGGER update_medical_form_templates_updated_at
  BEFORE UPDATE ON public.medical_form_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_medical_templates_profile ON public.medical_form_templates(profile_id);

-- ============ CONSENT TEMPLATES ============
CREATE TABLE public.consent_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE, -- NULL = system
  name text NOT NULL,
  treatment_type text, -- 'botox' | 'filler' | 'skin' | 'generic' etc.
  body_markdown text NOT NULL DEFAULT '',
  requires_signature boolean NOT NULL DEFAULT true,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.consent_templates TO authenticated;
GRANT ALL ON public.consent_templates TO service_role;

ALTER TABLE public.consent_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Practitioners read system or own consents"
  ON public.consent_templates FOR SELECT TO authenticated
  USING (is_system = true OR (profile_id IS NOT NULL AND public.is_profile_owner(profile_id)));

CREATE POLICY "Practitioners insert their own consents"
  ON public.consent_templates FOR INSERT TO authenticated
  WITH CHECK (is_system = false AND profile_id IS NOT NULL AND public.is_profile_owner(profile_id));

CREATE POLICY "Practitioners update their own consents"
  ON public.consent_templates FOR UPDATE TO authenticated
  USING (is_system = false AND profile_id IS NOT NULL AND public.is_profile_owner(profile_id))
  WITH CHECK (is_system = false AND profile_id IS NOT NULL AND public.is_profile_owner(profile_id));

CREATE POLICY "Practitioners delete their own consents"
  ON public.consent_templates FOR DELETE TO authenticated
  USING (is_system = false AND profile_id IS NOT NULL AND public.is_profile_owner(profile_id));

CREATE TRIGGER update_consent_templates_updated_at
  BEFORE UPDATE ON public.consent_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_consent_templates_profile ON public.consent_templates(profile_id);

-- Platform-wide email customizations (admin-managed, applies to auth emails)
CREATE TABLE public.platform_email_customizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key TEXT NOT NULL UNIQUE,
  subject_override TEXT,
  intro_override TEXT,
  closing_override TEXT,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.platform_email_customizations TO anon, authenticated;
GRANT ALL ON public.platform_email_customizations TO service_role;

ALTER TABLE public.platform_email_customizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can read platform email customizations"
  ON public.platform_email_customizations FOR SELECT
  USING (true);

CREATE POLICY "admins can insert platform email customizations"
  ON public.platform_email_customizations FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins can update platform email customizations"
  ON public.platform_email_customizations FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins can delete platform email customizations"
  ON public.platform_email_customizations FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_platform_email_customizations_updated_at
  BEFORE UPDATE ON public.platform_email_customizations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Admin broadcast log — audit + prevent duplicate sends
CREATE TABLE public.admin_broadcasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sent_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  audience TEXT NOT NULL CHECK (audience IN ('all_practitioners', 'user')),
  recipient_email TEXT,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  cta_text TEXT,
  cta_url TEXT,
  recipient_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.admin_broadcasts TO authenticated;
GRANT ALL ON public.admin_broadcasts TO service_role;

ALTER TABLE public.admin_broadcasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins can view broadcasts"
  ON public.admin_broadcasts FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins can insert broadcasts"
  ON public.admin_broadcasts FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND sent_by = auth.uid());

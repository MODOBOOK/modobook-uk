
-- 1) clinic_clients: opt-in timestamp + source (opt-in bool already exists)
ALTER TABLE public.clinic_clients
  ADD COLUMN IF NOT EXISTS marketing_opt_in_at timestamptz,
  ADD COLUMN IF NOT EXISTS marketing_opt_in_source text;

-- 2) Segments (dynamic filters OR static list of client ids in rules.static_ids)
CREATE TABLE IF NOT EXISTS public.marketing_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  kind text NOT NULL DEFAULT 'dynamic' CHECK (kind IN ('dynamic','static')),
  rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_segments TO authenticated;
GRANT ALL ON public.marketing_segments TO service_role;
ALTER TABLE public.marketing_segments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "practitioner manages own segments"
  ON public.marketing_segments FOR ALL TO authenticated
  USING (practitioner_id = auth.uid())
  WITH CHECK (practitioner_id = auth.uid());
CREATE INDEX IF NOT EXISTS marketing_segments_practitioner_idx
  ON public.marketing_segments(practitioner_id);

-- 3) Templates
CREATE TABLE IF NOT EXISTS public.marketing_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  subject text NOT NULL DEFAULT '',
  preheader text,
  body_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_templates TO authenticated;
GRANT ALL ON public.marketing_templates TO service_role;
ALTER TABLE public.marketing_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "practitioner manages own templates"
  ON public.marketing_templates FOR ALL TO authenticated
  USING (practitioner_id = auth.uid())
  WITH CHECK (practitioner_id = auth.uid());
CREATE INDEX IF NOT EXISTS marketing_templates_practitioner_idx
  ON public.marketing_templates(practitioner_id);

-- 4) Campaigns
CREATE TABLE IF NOT EXISTS public.marketing_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  practitioner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  subject text NOT NULL DEFAULT '',
  preheader text,
  body_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  segment_id uuid REFERENCES public.marketing_segments(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','scheduled','sending','sent','cancelled','failed')),
  scheduled_for timestamptz,
  sent_at timestamptz,
  recipient_count integer NOT NULL DEFAULT 0,
  sent_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  suppressed_count integer NOT NULL DEFAULT 0,
  unsubscribed_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_campaigns TO authenticated;
GRANT ALL ON public.marketing_campaigns TO service_role;
ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "practitioner manages own campaigns"
  ON public.marketing_campaigns FOR ALL TO authenticated
  USING (practitioner_id = auth.uid())
  WITH CHECK (practitioner_id = auth.uid());
CREATE INDEX IF NOT EXISTS marketing_campaigns_practitioner_idx
  ON public.marketing_campaigns(practitioner_id);
CREATE INDEX IF NOT EXISTS marketing_campaigns_scheduled_idx
  ON public.marketing_campaigns(status, scheduled_for);

-- 5) Per-recipient tracking
CREATE TABLE IF NOT EXISTS public.marketing_campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE,
  practitioner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clinic_clients(id) ON DELETE SET NULL,
  email text NOT NULL,
  message_id text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','sent','failed','suppressed','unsubscribed')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_campaign_recipients TO authenticated;
GRANT ALL ON public.marketing_campaign_recipients TO service_role;
ALTER TABLE public.marketing_campaign_recipients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "practitioner reads own campaign recipients"
  ON public.marketing_campaign_recipients FOR SELECT TO authenticated
  USING (practitioner_id = auth.uid());
CREATE INDEX IF NOT EXISTS mcr_campaign_idx
  ON public.marketing_campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS mcr_practitioner_idx
  ON public.marketing_campaign_recipients(practitioner_id);

-- 6) updated_at triggers (reuse existing helper if present)
CREATE OR REPLACE FUNCTION public.tg_marketing_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS marketing_segments_touch ON public.marketing_segments;
CREATE TRIGGER marketing_segments_touch BEFORE UPDATE ON public.marketing_segments
  FOR EACH ROW EXECUTE FUNCTION public.tg_marketing_touch_updated_at();

DROP TRIGGER IF EXISTS marketing_templates_touch ON public.marketing_templates;
CREATE TRIGGER marketing_templates_touch BEFORE UPDATE ON public.marketing_templates
  FOR EACH ROW EXECUTE FUNCTION public.tg_marketing_touch_updated_at();

DROP TRIGGER IF EXISTS marketing_campaigns_touch ON public.marketing_campaigns;
CREATE TRIGGER marketing_campaigns_touch BEFORE UPDATE ON public.marketing_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.tg_marketing_touch_updated_at();

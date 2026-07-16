
CREATE TABLE public.marketing_automations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  practitioner_id UUID NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('birthday','treatment_interval','win_back','monthly_newsletter','custom_recurring')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  template_id UUID NULL REFERENCES public.marketing_templates(id) ON DELETE SET NULL,
  segment_id UUID NULL REFERENCES public.marketing_segments(id) ON DELETE SET NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_run_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_automations TO authenticated;
GRANT ALL ON public.marketing_automations TO service_role;
ALTER TABLE public.marketing_automations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own automations" ON public.marketing_automations FOR ALL TO authenticated
  USING (public.is_profile_owner(practitioner_id) OR public.is_clinic_staff(practitioner_id))
  WITH CHECK (public.is_profile_owner(practitioner_id) OR public.is_clinic_staff(practitioner_id));

CREATE INDEX idx_marketing_automations_practitioner ON public.marketing_automations(practitioner_id);
CREATE INDEX idx_marketing_automations_enabled ON public.marketing_automations(enabled) WHERE enabled = true;

CREATE TABLE public.marketing_automation_sends (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  automation_id UUID NOT NULL REFERENCES public.marketing_automations(id) ON DELETE CASCADE,
  practitioner_id UUID NOT NULL,
  client_id UUID NOT NULL,
  dedup_key TEXT NOT NULL,
  message_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  error_message TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (automation_id, dedup_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_automation_sends TO authenticated;
GRANT ALL ON public.marketing_automation_sends TO service_role;
ALTER TABLE public.marketing_automation_sends ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own automation sends" ON public.marketing_automation_sends FOR ALL TO authenticated
  USING (public.is_profile_owner(practitioner_id) OR public.is_clinic_staff(practitioner_id))
  WITH CHECK (public.is_profile_owner(practitioner_id) OR public.is_clinic_staff(practitioner_id));

CREATE INDEX idx_automation_sends_automation ON public.marketing_automation_sends(automation_id);
CREATE INDEX idx_automation_sends_client ON public.marketing_automation_sends(client_id);

CREATE TRIGGER trg_marketing_automations_updated
  BEFORE UPDATE ON public.marketing_automations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

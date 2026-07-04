
-- Per-practitioner overrides for built-in email templates.
CREATE TABLE public.email_customizations (
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  template_key TEXT NOT NULL,
  subject_override TEXT,
  intro_override TEXT,
  closing_override TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, template_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_customizations TO authenticated;
GRANT ALL ON public.email_customizations TO service_role;
ALTER TABLE public.email_customizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages own email_customizations"
  ON public.email_customizations FOR ALL
  USING (auth.uid() = profile_id) WITH CHECK (auth.uid() = profile_id);

-- Practitioner-defined pre-appointment reminders.
CREATE TABLE public.appointment_reminder_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  hours_before INTEGER NOT NULL CHECK (hours_before > 0 AND hours_before <= 720),
  subject TEXT,
  intro TEXT,
  closing TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (profile_id, hours_before)
);
CREATE INDEX ON public.appointment_reminder_rules (profile_id, enabled);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointment_reminder_rules TO authenticated;
GRANT ALL ON public.appointment_reminder_rules TO service_role;
ALTER TABLE public.appointment_reminder_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages own reminder_rules"
  ON public.appointment_reminder_rules FOR ALL
  USING (auth.uid() = profile_id) WITH CHECK (auth.uid() = profile_id);

-- Dedup tracker: one row per (appointment, rule) that has been enqueued.
CREATE TABLE public.appointment_reminders_sent (
  appointment_id UUID NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  rule_id UUID NOT NULL REFERENCES public.appointment_reminder_rules(id) ON DELETE CASCADE,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (appointment_id, rule_id)
);
GRANT SELECT ON public.appointment_reminders_sent TO authenticated;
GRANT ALL ON public.appointment_reminders_sent TO service_role;
ALTER TABLE public.appointment_reminders_sent ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner can view own reminders sent"
  ON public.appointment_reminders_sent FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.appointments a
                 WHERE a.id = appointment_id AND a.profile_id = auth.uid()));

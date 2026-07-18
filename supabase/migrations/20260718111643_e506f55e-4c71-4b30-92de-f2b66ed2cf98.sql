
-- Structured medications list
CREATE TABLE public.client_medications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clinic_clients(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL,
  drug text NOT NULL,
  dose text,
  route text,
  frequency text,
  prescriber text,
  started_on date,
  stopped_on date,
  is_current boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_medications TO authenticated;
GRANT ALL ON public.client_medications TO service_role;
ALTER TABLE public.client_medications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Practitioner manages own client meds" ON public.client_medications
  FOR ALL USING (auth.uid() = profile_id) WITH CHECK (auth.uid() = profile_id);
CREATE INDEX client_medications_client_idx ON public.client_medications(client_id);

-- Cached AI patient briefs
CREATE TABLE public.patient_ai_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clinic_clients(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL,
  appointment_id uuid,
  brief jsonb NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_ai_briefs TO authenticated;
GRANT ALL ON public.patient_ai_briefs TO service_role;
ALTER TABLE public.patient_ai_briefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Practitioner reads own briefs" ON public.patient_ai_briefs
  FOR ALL USING (auth.uid() = profile_id) WITH CHECK (auth.uid() = profile_id);
CREATE INDEX patient_ai_briefs_client_idx ON public.patient_ai_briefs(client_id, generated_at DESC);

-- Manual timeline events (practitioner-added notes on the spine)
CREATE TABLE public.patient_timeline_manual_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clinic_clients(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL,
  kind text NOT NULL DEFAULT 'note',
  title text NOT NULL,
  body text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  shared_with_patient boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_timeline_manual_events TO authenticated;
GRANT ALL ON public.patient_timeline_manual_events TO service_role;
ALTER TABLE public.patient_timeline_manual_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Practitioner manages own manual events" ON public.patient_timeline_manual_events
  FOR ALL USING (auth.uid() = profile_id) WITH CHECK (auth.uid() = profile_id);
CREATE INDEX manual_events_client_idx ON public.patient_timeline_manual_events(client_id, occurred_at DESC);

-- Add safeguarding + GP jsonb + share-with-patient to clinic_clients
ALTER TABLE public.clinic_clients
  ADD COLUMN IF NOT EXISTS safeguarding_flag boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS safeguarding_note text,
  ADD COLUMN IF NOT EXISTS gp_details jsonb;

-- updated_at triggers reuse public.update_updated_at_column (already exists elsewhere)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_client_medications_updated BEFORE UPDATE ON public.client_medications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_manual_events_updated BEFORE UPDATE ON public.patient_timeline_manual_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

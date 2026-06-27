
CREATE TABLE public.consultations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  patient_name TEXT NOT NULL,
  patient_email TEXT,
  patient_phone TEXT,
  status TEXT NOT NULL DEFAULT 'in_progress',
  current_step SMALLINT NOT NULL DEFAULT 1,
  medical JSONB NOT NULL DEFAULT '{}'::jsonb,
  concerns JSONB NOT NULL DEFAULT '{}'::jsonb,
  assessment JSONB NOT NULL DEFAULT '{}'::jsonb,
  before_photos JSONB NOT NULL DEFAULT '[]'::jsonb,
  treatment_plan JSONB NOT NULL DEFAULT '{}'::jsonb,
  consent JSONB NOT NULL DEFAULT '{}'::jsonb,
  after_photos JSONB NOT NULL DEFAULT '[]'::jsonb,
  treatment_log JSONB NOT NULL DEFAULT '{}'::jsonb,
  invoice JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX consultations_profile_idx ON public.consultations(profile_id, created_at DESC);
CREATE INDEX consultations_patient_email_idx ON public.consultations(profile_id, lower(patient_email));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.consultations TO authenticated;
GRANT ALL ON public.consultations TO service_role;

ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Practitioners manage their consultations"
  ON public.consultations FOR ALL
  TO authenticated
  USING (public.is_profile_owner(profile_id))
  WITH CHECK (public.is_profile_owner(profile_id));

CREATE TRIGGER update_consultations_updated_at
  BEFORE UPDATE ON public.consultations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

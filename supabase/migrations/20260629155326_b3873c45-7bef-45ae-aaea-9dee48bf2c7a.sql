
-- Quiz settings on practitioner profile
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS quiz_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS quiz_intro text,
  ADD COLUMN IF NOT EXISTS quiz_outro text;

-- Per-treatment tags used by the quiz matcher
ALTER TABLE public.treatments
  ADD COLUMN IF NOT EXISTS quiz_tags jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Stored quiz submissions (anonymous OK)
CREATE TABLE IF NOT EXISTS public.quiz_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clinic_clients(id) ON DELETE SET NULL,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  recommended_treatment_ids uuid[] NOT NULL DEFAULT '{}',
  patient_email text,
  patient_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_responses TO authenticated;
GRANT INSERT ON public.quiz_responses TO anon;
GRANT ALL ON public.quiz_responses TO service_role;

ALTER TABLE public.quiz_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Practitioners read own quiz responses"
  ON public.quiz_responses FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());

CREATE POLICY "Practitioners delete own quiz responses"
  ON public.quiz_responses FOR DELETE
  TO authenticated
  USING (profile_id = auth.uid());

CREATE POLICY "Anyone can submit a quiz response"
  ON public.quiz_responses FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS quiz_responses_profile_idx ON public.quiz_responses (profile_id, created_at DESC);

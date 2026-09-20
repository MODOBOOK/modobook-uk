CREATE TABLE public.compliance_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  noted_on date NOT NULL DEFAULT current_date,
  created_by_name text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.compliance_notes TO authenticated;
GRANT ALL ON public.compliance_notes TO service_role;

ALTER TABLE public.compliance_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic team can manage their compliance notes"
ON public.compliance_notes
FOR ALL
TO authenticated
USING (
  profile_id IN (
    SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid()
  )
  OR profile_id IN (
    SELECT s.profile_id FROM public.staff_members s
    WHERE s.user_id = auth.uid() AND s.status = 'active'
  )
)
WITH CHECK (
  profile_id IN (
    SELECT p.id FROM public.profiles p WHERE p.user_id = auth.uid()
  )
  OR profile_id IN (
    SELECT s.profile_id FROM public.staff_members s
    WHERE s.user_id = auth.uid() AND s.status = 'active'
  )
);

CREATE INDEX compliance_notes_profile_idx ON public.compliance_notes (profile_id, noted_on DESC);

CREATE TRIGGER compliance_notes_updated_at
BEFORE UPDATE ON public.compliance_notes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
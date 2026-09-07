CREATE TABLE public.practitioner_treatments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  practitioner_id uuid NOT NULL REFERENCES public.practitioners(id) ON DELETE CASCADE,
  treatment_id uuid NOT NULL REFERENCES public.treatments(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (practitioner_id, treatment_id)
);

CREATE INDEX idx_practitioner_treatments_practitioner ON public.practitioner_treatments(practitioner_id);
CREATE INDEX idx_practitioner_treatments_treatment ON public.practitioner_treatments(treatment_id);
CREATE INDEX idx_practitioner_treatments_profile ON public.practitioner_treatments(profile_id);

GRANT SELECT ON public.practitioner_treatments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.practitioner_treatments TO authenticated;
GRANT ALL ON public.practitioner_treatments TO service_role;

ALTER TABLE public.practitioner_treatments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage practitioner treatments"
ON public.practitioner_treatments FOR ALL TO authenticated
USING (public.is_profile_owner(profile_id))
WITH CHECK (public.is_profile_owner(profile_id));

CREATE POLICY "Clinic staff manage practitioner treatments"
ON public.practitioner_treatments FOR ALL TO authenticated
USING (public.is_clinic_staff(profile_id))
WITH CHECK (public.is_clinic_staff(profile_id));

CREATE POLICY "Public can view active practitioner treatments"
ON public.practitioner_treatments FOR SELECT TO anon, authenticated
USING (EXISTS (
  SELECT 1 FROM public.practitioners pr
  WHERE pr.id = practitioner_treatments.practitioner_id
    AND pr.active = true
    AND public.is_active_profile(pr.profile_id)
));
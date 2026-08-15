CREATE TABLE public.associate_access_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL REFERENCES public.clinic_associates(id) ON DELETE CASCADE,
  clinic_profile_id uuid NOT NULL,
  associate_profile_id uuid,
  client_id uuid,
  client_name text,
  actor_user_id uuid,
  actor_name text,
  action text NOT NULL DEFAULT 'view_record',
  reason text,
  lawful_basis text,
  consent_clinical boolean NOT NULL DEFAULT false,
  consent_minimum boolean NOT NULL DEFAULT false,
  consent_logged boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_associate_access_log_link ON public.associate_access_log(link_id, created_at DESC);
CREATE INDEX idx_associate_access_log_assoc ON public.associate_access_log(associate_profile_id, created_at DESC);

GRANT SELECT ON public.associate_access_log TO authenticated;
GRANT ALL ON public.associate_access_log TO service_role;

ALTER TABLE public.associate_access_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinic owner and associate can read access log"
  ON public.associate_access_log FOR SELECT TO authenticated
  USING (
    clinic_profile_id = public._profile_id_for_user(auth.uid())
    OR associate_profile_id = public._profile_id_for_user(auth.uid())
  );
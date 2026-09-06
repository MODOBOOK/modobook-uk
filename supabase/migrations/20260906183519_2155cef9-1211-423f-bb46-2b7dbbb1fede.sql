ALTER TABLE public.membership_plans
  ADD COLUMN IF NOT EXISTS terms_text text,
  ADD COLUMN IF NOT EXISTS terms_checkboxes jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS public.membership_terms_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES public.membership_plans(id) ON DELETE SET NULL,
  patient_user_id uuid NOT NULL,
  client_id uuid REFERENCES public.clinic_clients(id) ON DELETE SET NULL,
  patient_email text,
  plan_name text,
  terms_text text,
  checkbox_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  accepted_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.membership_terms_acceptances TO authenticated;
GRANT ALL ON public.membership_terms_acceptances TO service_role;

ALTER TABLE public.membership_terms_acceptances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Patients view own membership terms acceptances"
ON public.membership_terms_acceptances
FOR SELECT TO authenticated
USING (patient_user_id = auth.uid());

CREATE POLICY "Patients record own membership terms acceptances"
ON public.membership_terms_acceptances
FOR INSERT TO authenticated
WITH CHECK (patient_user_id = auth.uid());

CREATE POLICY "Clinics view their membership terms acceptances"
ON public.membership_terms_acceptances
FOR SELECT TO authenticated
USING (clinic_profile_id = public._profile_id_for_user(auth.uid()));

CREATE INDEX IF NOT EXISTS membership_terms_acceptances_clinic_idx
  ON public.membership_terms_acceptances (clinic_profile_id, patient_user_id);

CREATE TRIGGER update_membership_terms_acceptances_updated_at
BEFORE UPDATE ON public.membership_terms_acceptances
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Extend clinic_clients
ALTER TABLE public.clinic_clients
  ADD COLUMN IF NOT EXISTS county text,
  ADD COLUMN IF NOT EXISTS address_line1 text,
  ADD COLUMN IF NOT EXISTS address_line2 text,
  ADD COLUMN IF NOT EXISTS postcode text,
  ADD COLUMN IF NOT EXISTS preferred_contact text,
  ADD COLUMN IF NOT EXISTS marketing_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS how_heard text,
  ADD COLUMN IF NOT EXISTS gp_name text,
  ADD COLUMN IF NOT EXISTS gp_address text,
  ADD COLUMN IF NOT EXISTS emergency_contact_name text,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone text,
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

-- Notes
CREATE TABLE IF NOT EXISTS public.client_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clinic_clients(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_notes TO authenticated;
GRANT ALL ON public.client_notes TO service_role;
ALTER TABLE public.client_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Practitioner manages own client notes" ON public.client_notes
  TO authenticated USING (public.is_profile_owner(profile_id)) WITH CHECK (public.is_profile_owner(profile_id));
CREATE TRIGGER client_notes_updated_at BEFORE UPDATE ON public.client_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Files (photos + pdfs)
CREATE TABLE IF NOT EXISTS public.client_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clinic_clients(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('photo','pdf')),
  url text NOT NULL,
  filename text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_files TO authenticated;
GRANT ALL ON public.client_files TO service_role;
ALTER TABLE public.client_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Practitioner manages own client files" ON public.client_files
  TO authenticated USING (public.is_profile_owner(profile_id)) WITH CHECK (public.is_profile_owner(profile_id));

-- Prescriptions
CREATE TABLE IF NOT EXISTS public.client_prescriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clinic_clients(id) ON DELETE CASCADE,
  product text NOT NULL,
  dose text,
  directions text,
  prescribed_on date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_prescriptions TO authenticated;
GRANT ALL ON public.client_prescriptions TO service_role;
ALTER TABLE public.client_prescriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Practitioner manages own prescriptions" ON public.client_prescriptions
  TO authenticated USING (public.is_profile_owner(profile_id)) WITH CHECK (public.is_profile_owner(profile_id));
CREATE TRIGGER client_prescriptions_updated_at BEFORE UPDATE ON public.client_prescriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

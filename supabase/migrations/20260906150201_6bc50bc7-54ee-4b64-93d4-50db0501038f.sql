CREATE TABLE public.prescriber_directory_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  display_name text NOT NULL,
  bio text,
  town text NOT NULL,
  postcode_area text,
  travel_radius_miles integer NOT NULL DEFAULT 25,
  services text[] NOT NULL DEFAULT '{}',
  availability text,
  day_rate_pence integer,
  rates_on_request boolean NOT NULL DEFAULT true,
  contact_email text,
  contact_phone text,
  is_listed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prescriber_directory_listings TO authenticated;
GRANT ALL ON public.prescriber_directory_listings TO service_role;
ALTER TABLE public.prescriber_directory_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Practitioners can view live listings; prescribers see their own"
  ON public.prescriber_directory_listings FOR SELECT TO authenticated
  USING (is_listed OR auth.uid() = user_id);
CREATE POLICY "Prescribers manage their own listing"
  ON public.prescriber_directory_listings FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.prescriber_connect_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prescriber_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  practitioner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  clinic_name text,
  practitioner_name text,
  practitioner_email text,
  practitioner_phone text,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prescriber_connect_requests TO authenticated;
GRANT ALL ON public.prescriber_connect_requests TO service_role;
ALTER TABLE public.prescriber_connect_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Both sides can view their connect requests"
  ON public.prescriber_connect_requests FOR SELECT TO authenticated
  USING (auth.uid() = prescriber_user_id OR auth.uid() = practitioner_user_id);
CREATE POLICY "Practitioners send connect requests as themselves"
  ON public.prescriber_connect_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = practitioner_user_id);
CREATE POLICY "Prescribers respond to requests sent to them"
  ON public.prescriber_connect_requests FOR UPDATE TO authenticated
  USING (auth.uid() = prescriber_user_id) WITH CHECK (auth.uid() = prescriber_user_id);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.prescriber_directory_listings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.prescriber_connect_requests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
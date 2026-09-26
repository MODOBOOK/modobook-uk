CREATE TABLE public.patient_waitlist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  treatment_id UUID REFERENCES public.treatments(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  preferred_times TEXT,
  urgency TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'waiting',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT INSERT ON public.patient_waitlist TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_waitlist TO authenticated;
GRANT ALL ON public.patient_waitlist TO service_role;

ALTER TABLE public.patient_waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can join a clinic waitlist"
  ON public.patient_waitlist FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Clinic owners can view their waitlist"
  ON public.patient_waitlist FOR SELECT TO authenticated
  USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Clinic owners can update their waitlist"
  ON public.patient_waitlist FOR UPDATE TO authenticated
  USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
  WITH CHECK (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Clinic owners can delete waitlist entries"
  ON public.patient_waitlist FOR DELETE TO authenticated
  USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.update_patient_waitlist_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_patient_waitlist_updated_at
  BEFORE UPDATE ON public.patient_waitlist
  FOR EACH ROW EXECUTE FUNCTION public.update_patient_waitlist_updated_at();
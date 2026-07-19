
CREATE TABLE public.practitioner_waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  role TEXT,
  clinic_name TEXT,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.practitioner_waitlist TO authenticated;
GRANT INSERT ON public.practitioner_waitlist TO anon;
GRANT ALL ON public.practitioner_waitlist TO service_role;
ALTER TABLE public.practitioner_waitlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can join the waitlist" ON public.practitioner_waitlist
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Admins can view waitlist" ON public.practitioner_waitlist
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete waitlist" ON public.practitioner_waitlist
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

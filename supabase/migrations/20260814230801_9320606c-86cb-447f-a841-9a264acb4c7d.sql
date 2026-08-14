CREATE TABLE public.hair_beauty_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text NOT NULL,
  clinic_name text,
  phone text,
  instagram text,
  clinic_type text NOT NULL CHECK (clinic_type IN ('hair','beauty','multi')),
  ideas text,
  source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.hair_beauty_waitlist TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hair_beauty_waitlist TO authenticated;
GRANT ALL ON public.hair_beauty_waitlist TO service_role;

ALTER TABLE public.hair_beauty_waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can join the hair and beauty waitlist"
ON public.hair_beauty_waitlist FOR INSERT TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Admins can view hair and beauty waitlist"
ON public.hair_beauty_waitlist FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update hair and beauty waitlist"
ON public.hair_beauty_waitlist FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete hair and beauty waitlist"
ON public.hair_beauty_waitlist FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_hair_beauty_waitlist_updated_at
BEFORE UPDATE ON public.hair_beauty_waitlist
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
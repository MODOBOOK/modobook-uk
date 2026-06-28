
CREATE TABLE public.practitioners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  professional_title text,
  photo_url text,
  bio text,
  display_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX practitioners_profile_idx ON public.practitioners(profile_id);

GRANT SELECT ON public.practitioners TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.practitioners TO authenticated;
GRANT ALL ON public.practitioners TO service_role;

ALTER TABLE public.practitioners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active practitioners"
  ON public.practitioners FOR SELECT
  USING (active = true);

CREATE POLICY "Owners manage their practitioners"
  ON public.practitioners FOR ALL
  USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
  WITH CHECK (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE TRIGGER practitioners_updated_at
  BEFORE UPDATE ON public.practitioners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.location_practitioners (
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  practitioner_id uuid NOT NULL REFERENCES public.practitioners(id) ON DELETE CASCADE,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (location_id, practitioner_id)
);
CREATE INDEX location_practitioners_practitioner_idx ON public.location_practitioners(practitioner_id);

GRANT SELECT ON public.location_practitioners TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.location_practitioners TO authenticated;
GRANT ALL ON public.location_practitioners TO service_role;

ALTER TABLE public.location_practitioners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view location practitioners"
  ON public.location_practitioners FOR SELECT
  USING (true);

CREATE POLICY "Owners manage location practitioners"
  ON public.location_practitioners FOR ALL
  USING (practitioner_id IN (
    SELECT p.id FROM public.practitioners p
    JOIN public.profiles pr ON pr.id = p.profile_id
    WHERE pr.user_id = auth.uid()
  ))
  WITH CHECK (practitioner_id IN (
    SELECT p.id FROM public.practitioners p
    JOIN public.profiles pr ON pr.id = p.profile_id
    WHERE pr.user_id = auth.uid()
  ));

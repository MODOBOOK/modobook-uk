
-- 1) Marketing tables: missing GRANTs
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_campaigns TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_segments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_templates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_campaign_recipients TO authenticated;
GRANT ALL ON public.marketing_campaigns TO service_role;
GRANT ALL ON public.marketing_segments TO service_role;
GRANT ALL ON public.marketing_templates TO service_role;
GRANT ALL ON public.marketing_campaign_recipients TO service_role;

-- 2) Training courses: visibility + preview token
DO $$ BEGIN
  CREATE TYPE public.training_visibility AS ENUM ('live','hidden','preview_link','coming_soon');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.training_courses
  ADD COLUMN IF NOT EXISTS visibility public.training_visibility NOT NULL DEFAULT 'live',
  ADD COLUMN IF NOT EXISTS preview_token text UNIQUE DEFAULT encode(gen_random_bytes(12), 'hex');

-- Backfill: existing inactive rows become hidden
UPDATE public.training_courses SET visibility = 'hidden' WHERE active = false AND visibility = 'live';

-- 3) Training <-> Locations join
CREATE TABLE IF NOT EXISTS public.training_course_locations (
  course_id uuid NOT NULL REFERENCES public.training_courses(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (course_id, location_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_course_locations TO authenticated;
GRANT SELECT ON public.training_course_locations TO anon;
GRANT ALL ON public.training_course_locations TO service_role;

ALTER TABLE public.training_course_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "practitioners manage their course locations"
ON public.training_course_locations FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.training_courses tc
  JOIN public.profiles p ON p.id = tc.profile_id
  WHERE tc.id = training_course_locations.course_id AND p.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.training_courses tc
  JOIN public.profiles p ON p.id = tc.profile_id
  WHERE tc.id = training_course_locations.course_id AND p.user_id = auth.uid()
));

CREATE POLICY "public reads course locations"
ON public.training_course_locations FOR SELECT
TO anon, authenticated
USING (true);

CREATE INDEX IF NOT EXISTS training_course_locations_location_idx
  ON public.training_course_locations(location_id);

ALTER TABLE public.training_courses
  ADD COLUMN IF NOT EXISTS training_category_id uuid REFERENCES public.treatment_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS training_courses_training_category_id_idx
  ON public.training_courses(training_category_id);

ALTER TABLE public.treatment_categories DROP CONSTRAINT IF EXISTS treatment_categories_kind_check;
ALTER TABLE public.treatment_categories
  ADD CONSTRAINT treatment_categories_kind_check
  CHECK (kind IN ('treatment', 'package', 'training'));

-- Convert existing free-text categories into real, orderable category rows.
DO $$
DECLARE r record;
DECLARE new_id uuid;
BEGIN
  FOR r IN
    SELECT DISTINCT profile_id, btrim(category) AS cat
    FROM public.training_courses
    WHERE category IS NOT NULL AND btrim(category) <> ''
  LOOP
    SELECT id INTO new_id FROM public.treatment_categories
      WHERE profile_id = r.profile_id AND kind = 'training' AND name = r.cat LIMIT 1;
    IF new_id IS NULL THEN
      INSERT INTO public.treatment_categories (profile_id, name, kind, slug, sort_order)
      VALUES (r.profile_id, r.cat, 'training',
              'trn-' || regexp_replace(lower(r.cat), '[^a-z0-9]+', '-', 'g'), 0)
      RETURNING id INTO new_id;
    END IF;
    UPDATE public.training_courses
      SET training_category_id = new_id
      WHERE profile_id = r.profile_id AND btrim(category) = r.cat AND training_category_id IS NULL;
  END LOOP;
END $$;

-- Public read of training category names/order for public training pages.
DROP POLICY IF EXISTS "Public can view training categories" ON public.treatment_categories;
CREATE POLICY "Public can view training categories"
  ON public.treatment_categories FOR SELECT TO anon
  USING (kind = 'training');

GRANT SELECT ON public.treatment_categories TO anon;
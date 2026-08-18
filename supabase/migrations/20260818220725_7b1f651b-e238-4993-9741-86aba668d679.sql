DO $$
DECLARE pid uuid; cat uuid;
BEGIN
  SELECT id INTO pid FROM public.profiles WHERE slug = 'aestheticsbynurseryan';

  INSERT INTO public.treatment_categories (profile_id, name, slug, sort_order, kind, is_limited, limited_ends_at)
  VALUES (pid, 'Autumn Packages 🍂', 'pkg-autumn-packages', 0, 'package', true, '2026-10-31 23:45:00+00')
  RETURNING id INTO cat;

  INSERT INTO public.packages (profile_id, name, description, treatment_id, treatment_ids, session_count, price, duration_minutes, category_id, active, is_limited, limited_ends_at, sort_order)
  SELECT t.profile_id, t.name, t.description, t.id, ARRAY[t.id], 1, t.price, t.duration, cat, true, true, '2026-10-31 23:45:00+00', row_number() over (order by t.price)
  FROM public.treatments t
  WHERE t.category_id = '1b24d897-00af-4abd-b711-65a3730e2891';

  UPDATE public.treatment_categories SET is_limited = false, limited_ends_at = NULL WHERE id = '1b24d897-00af-4abd-b711-65a3730e2891';
  UPDATE public.treatments SET active = false WHERE category_id = '1b24d897-00af-4abd-b711-65a3730e2891';
END $$;
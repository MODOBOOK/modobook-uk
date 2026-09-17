DO $$
DECLARE p RECORD; new_id uuid;
BEGIN
  FOR p IN
    SELECT id, profile_id, name, description, duration_minutes
    FROM public.packages
    WHERE active = true
      AND is_custom = false
      AND treatment_id IS NULL
      AND (treatment_ids IS NULL OR cardinality(treatment_ids) = 0)
  LOOP
    INSERT INTO public.treatments (profile_id, name, description, duration, price, active, hidden_from_menu, category_id)
    VALUES (p.profile_id, p.name, p.description, COALESCE(NULLIF(p.duration_minutes, 0), 60), 0, true, true, NULL)
    RETURNING id INTO new_id;

    UPDATE public.packages
    SET treatment_id = new_id, treatment_ids = ARRAY[new_id]
    WHERE id = p.id;
  END LOOP;
END $$;
WITH t AS (
  INSERT INTO public.treatments (profile_id, name, duration, price, active, hidden_from_menu)
  VALUES ('b8118d60-745e-4130-8008-085bab10df35', 'The Elder Gen Z', 60, 0, true, true)
  RETURNING id
)
UPDATE public.packages p
SET treatment_id = t.id, treatment_ids = ARRAY[t.id]
FROM t
WHERE p.id = 'a441a243-4ad3-4c02-b4d4-de2c6c956636';
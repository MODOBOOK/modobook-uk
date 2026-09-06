UPDATE public.clinic_clients c
SET address = NULLIF(trim(concat_ws(', ',
      NULLIF((c.address::jsonb)->>'line1',''),
      NULLIF((c.address::jsonb)->>'line2',''),
      NULLIF((c.address::jsonb)->>'city',''),
      NULLIF((c.address::jsonb)->>'postcode',''),
      NULLIF((c.address::jsonb)->>'country','')
    )), '')
WHERE c.address LIKE '{%}';

UPDATE public.appointments a
SET patient_address = jsonb_strip_nulls(jsonb_build_object(
      'line1', NULLIF(((a.patient_address->>'line1')::jsonb)->>'line1',''),
      'line2', NULLIF(((a.patient_address->>'line1')::jsonb)->>'line2',''),
      'city', COALESCE(NULLIF(a.patient_address->>'city',''), ((a.patient_address->>'line1')::jsonb)->>'city'),
      'postcode', COALESCE(NULLIF(a.patient_address->>'postcode',''), ((a.patient_address->>'line1')::jsonb)->>'postcode'),
      'country', COALESCE(NULLIF(a.patient_address->>'country',''), ((a.patient_address->>'line1')::jsonb)->>'country')
    ))
WHERE a.patient_address->>'line1' LIKE '{%}';
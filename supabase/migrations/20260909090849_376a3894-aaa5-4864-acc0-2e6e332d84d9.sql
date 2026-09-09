CREATE OR REPLACE FUNCTION public.sync_appointment_to_client()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
  v_addr jsonb := NEW.patient_address;
  v_name text := nullif(btrim(NEW.patient_name), '');
BEGIN
  IF NEW.patient_email IS NULL OR NEW.patient_email = '' THEN RETURN NEW; END IF;
  IF NEW.status::text IN ('pending','cancelled','expired') THEN RETURN NEW; END IF;

  SELECT id INTO v_id FROM public.clinic_clients
    WHERE profile_id = NEW.profile_id AND lower(email) = lower(NEW.patient_email)
    LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.clinic_clients (
      profile_id, full_name, email, phone, dob,
      address_line1, address_line2, city, postcode, country
    ) VALUES (
      NEW.profile_id, v_name, NEW.patient_email, NEW.patient_phone, NEW.patient_dob,
      v_addr->>'line1', v_addr->>'line2', v_addr->>'city', v_addr->>'postcode', v_addr->>'country'
    );
  ELSE
    UPDATE public.clinic_clients SET
      full_name = CASE
        WHEN v_name IS NOT NULL AND v_name NOT LIKE '%@%'
             AND (full_name IS NULL OR btrim(full_name) = '' OR full_name LIKE '%@%')
          THEN v_name
        ELSE COALESCE(NULLIF(full_name,''), v_name)
      END,
      phone = COALESCE(NULLIF(phone,''), NEW.patient_phone),
      dob = COALESCE(dob, NEW.patient_dob),
      address_line1 = COALESCE(NULLIF(address_line1,''), v_addr->>'line1'),
      address_line2 = COALESCE(NULLIF(address_line2,''), v_addr->>'line2'),
      city = COALESCE(NULLIF(city,''), v_addr->>'city'),
      postcode = COALESCE(NULLIF(postcode,''), v_addr->>'postcode'),
      country = COALESCE(NULLIF(country,''), v_addr->>'country'),
      updated_at = now()
    WHERE id = v_id;
  END IF;
  RETURN NEW;
END;
$function$;

UPDATE public.clinic_clients c
SET full_name = a.patient_name, updated_at = now()
FROM (
  SELECT DISTINCT ON (profile_id, lower(patient_email)) profile_id, lower(patient_email) AS em, btrim(patient_name) AS patient_name
  FROM public.appointments
  WHERE patient_email IS NOT NULL AND btrim(coalesce(patient_name,'')) <> '' AND patient_name NOT LIKE '%@%'
  ORDER BY profile_id, lower(patient_email), created_at DESC
) a
WHERE c.profile_id = a.profile_id
  AND lower(c.email) = a.em
  AND (c.full_name IS NULL OR btrim(c.full_name) = '' OR c.full_name LIKE '%@%');
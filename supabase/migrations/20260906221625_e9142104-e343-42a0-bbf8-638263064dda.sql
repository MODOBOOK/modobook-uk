CREATE OR REPLACE FUNCTION public.submit_medical_form(p_token text, p_response jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_form record;
  v_client_id uuid;
  v_email text;
  v_phone text;
  v_name text;
  v_dob date;
  v_address text;
  v_address_line1 text;
  v_address_line2 text;
  v_postcode text;
  v_city text;
  v_county text;
  v_gp_name text;
  v_gp_address text;
  v_emergency_name text;
  v_emergency_phone text;
  v_allergies text;
BEGIN
  SELECT amf.*, a.patient_name, a.patient_email, a.patient_phone, a.patient_dob, a.patient_address
  INTO v_form
  FROM public.appointment_medical_forms amf
  LEFT JOIN public.appointments a ON a.id = amf.appointment_id
  WHERE amf.token = p_token
  LIMIT 1;

  IF v_form.id IS NULL THEN
    RETURN false;
  END IF;

  IF v_form.status = 'submitted' THEN
    RETURN true;
  END IF;

  v_email := lower(NULLIF(trim(COALESCE(p_response->>'email', p_response->>'email_address', v_form.recipient_email, v_form.patient_email, '')), ''));
  v_phone := NULLIF(trim(COALESCE(p_response->>'phone', p_response->>'contact_number', p_response->>'mobile', v_form.recipient_phone, v_form.patient_phone, '')), '');
  v_name := NULLIF(trim(COALESCE(p_response->>'full_name', p_response->>'name', v_form.patient_name, '')), '');
  v_address_line1 := NULLIF(trim(COALESCE(p_response->>'address_line1', p_response->>'address_1', p_response->>'street', '')), '');
  v_address_line2 := NULLIF(trim(COALESCE(p_response->>'address_line2', p_response->>'address_2', '')), '');
  v_postcode := NULLIF(trim(COALESCE(p_response->>'postcode', p_response->>'postal_code', p_response->>'zip', '')), '');
  v_city := NULLIF(trim(COALESCE(p_response->>'city', p_response->>'town', '')), '');
  v_county := NULLIF(trim(COALESCE(p_response->>'county', p_response->>'state', p_response->>'region', '')), '');
  v_address := NULLIF(trim(COALESCE(p_response->>'address', p_response->>'home_address',
    NULLIF(trim(concat_ws(', ',
      NULLIF(v_form.patient_address->>'line1',''),
      NULLIF(v_form.patient_address->>'line2',''),
      NULLIF(v_form.patient_address->>'city',''),
      NULLIF(v_form.patient_address->>'postcode',''),
      NULLIF(v_form.patient_address->>'country','')
    )), ''),
    '')), '');
  IF v_address IS NULL AND (v_address_line1 IS NOT NULL OR v_postcode IS NOT NULL) THEN
    v_address := NULLIF(trim(concat_ws(', ', v_address_line1, v_address_line2, v_city, v_county, v_postcode)), '');
  END IF;
  v_gp_name := NULLIF(trim(COALESCE(p_response->>'gp_name', p_response->>'doctor_name', '')), '');
  v_gp_address := NULLIF(trim(COALESCE(p_response->>'gp_address', p_response->>'gp_practice', p_response->>'gp_surgery', '')), '');
  v_emergency_name := NULLIF(trim(COALESCE(p_response->>'emergency_contact_name', p_response->>'next_of_kin_name', p_response->>'nok_name', '')), '');
  v_emergency_phone := NULLIF(trim(COALESCE(p_response->>'emergency_contact_phone', p_response->>'next_of_kin_phone', p_response->>'nok_phone', '')), '');
  v_allergies := NULLIF(trim(COALESCE(p_response->>'allergies_details', p_response->>'allergy_details', p_response->>'known_allergies', p_response->>'allergies', '')), '');

  BEGIN
    v_dob := COALESCE(NULLIF(p_response->>'dob', '')::date, NULLIF(p_response->>'date_of_birth', '')::date, v_form.patient_dob);
  EXCEPTION WHEN others THEN
    v_dob := v_form.patient_dob;
  END;

  IF v_form.client_id IS NOT NULL THEN
    v_client_id := v_form.client_id;
  ELSIF v_email IS NOT NULL THEN
    SELECT id INTO v_client_id
    FROM public.clinic_clients
    WHERE profile_id = v_form.profile_id AND lower(email) = v_email
    ORDER BY created_at DESC LIMIT 1;
  END IF;

  IF v_client_id IS NULL THEN
    INSERT INTO public.clinic_clients (
      profile_id, full_name, email, phone, dob, address,
      address_line1, address_line2, postcode, city, county,
      gp_name, gp_address, emergency_contact_name, emergency_contact_phone,
      allergies, has_allergies, medical_form_data, medical_form_updated_at
    ) VALUES (
      v_form.profile_id, COALESCE(v_name, v_email, 'Patient'), v_email, v_phone, v_dob, v_address,
      v_address_line1, v_address_line2, v_postcode, v_city, v_county,
      v_gp_name, v_gp_address, v_emergency_name, v_emergency_phone,
      v_allergies, v_allergies IS NOT NULL, p_response, now()
    )
    RETURNING id INTO v_client_id;
  ELSE
    UPDATE public.clinic_clients
    SET full_name = COALESCE(NULLIF(full_name, ''), v_name, full_name),
        email = COALESCE(NULLIF(email, ''), v_email, email),
        phone = COALESCE(v_phone, phone),
        dob = COALESCE(dob, v_dob),
        address = COALESCE(v_address, address),
        address_line1 = COALESCE(v_address_line1, address_line1),
        address_line2 = COALESCE(v_address_line2, address_line2),
        postcode = COALESCE(v_postcode, postcode),
        city = COALESCE(v_city, city),
        county = COALESCE(v_county, county),
        gp_name = COALESCE(v_gp_name, gp_name),
        gp_address = COALESCE(v_gp_address, gp_address),
        emergency_contact_name = COALESCE(v_emergency_name, emergency_contact_name),
        emergency_contact_phone = COALESCE(v_emergency_phone, emergency_contact_phone),
        allergies = COALESCE(v_allergies, allergies),
        has_allergies = has_allergies OR (v_allergies IS NOT NULL),
        medical_form_data = p_response,
        medical_form_updated_at = now(),
        updated_at = now()
    WHERE id = v_client_id AND profile_id = v_form.profile_id;
  END IF;

  UPDATE public.appointment_medical_forms
  SET response = p_response, status = 'submitted', submitted_at = now(),
      client_id = COALESCE(client_id, v_client_id),
      recipient_email = COALESCE(recipient_email, v_email),
      recipient_phone = COALESCE(recipient_phone, v_phone)
  WHERE id = v_form.id;

  IF v_form.appointment_id IS NOT NULL THEN
    UPDATE public.appointments
    SET patient_user_id = COALESCE(patient_user_id, auth.uid()),
        patient_name = COALESCE(NULLIF(patient_name, ''), v_name, patient_name),
        patient_email = COALESCE(NULLIF(patient_email, ''), v_email, patient_email),
        patient_phone = COALESCE(v_phone, patient_phone),
        patient_dob = COALESCE(patient_dob, v_dob),
        patient_address = COALESCE(patient_address, to_jsonb(v_address))
    WHERE id = v_form.appointment_id;

    UPDATE public.consultations
    SET patient_id = COALESCE(patient_id, v_client_id),
        medical = COALESCE(medical, '{}'::jsonb) || jsonb_build_object('medical_form', p_response, 'medical_form_id', v_form.id, 'submitted_at', now()),
        updated_at = now()
    WHERE appointment_id = v_form.appointment_id AND profile_id = v_form.profile_id;
  END IF;

  RETURN true;
END;
$function$;

-- Repair records where a JSON address blob was stored in text address fields.
UPDATE public.clinic_clients c
SET address_line1 = NULLIF(trim(COALESCE((c.address_line1::jsonb)->>'line1','')),''),
    address_line2 = COALESCE(NULLIF(c.address_line2,''), NULLIF(trim(COALESCE((c.address_line1::jsonb)->>'line2','')),'')),
    city          = COALESCE(NULLIF(c.city,''), NULLIF(trim(COALESCE((c.address_line1::jsonb)->>'city','')),'')),
    postcode      = COALESCE(NULLIF(c.postcode,''), NULLIF(trim(COALESCE((c.address_line1::jsonb)->>'postcode','')),'')),
    country       = COALESCE(NULLIF(c.country,''), NULLIF(trim(COALESCE((c.address_line1::jsonb)->>'country','')),''))
WHERE c.address_line1 LIKE '{%}';

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
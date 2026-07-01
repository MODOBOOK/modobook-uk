CREATE OR REPLACE FUNCTION public.create_appointment_medical_forms()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
BEGIN
  IF NEW.patient_email IS NOT NULL THEN
    SELECT id INTO v_client_id
    FROM public.clinic_clients
    WHERE profile_id = NEW.profile_id
      AND lower(email) = lower(NEW.patient_email)
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  IF v_client_id IS NULL AND (NEW.patient_name IS NOT NULL OR NEW.patient_email IS NOT NULL) THEN
    INSERT INTO public.clinic_clients (
      profile_id,
      full_name,
      email,
      phone,
      dob,
      address
    ) VALUES (
      NEW.profile_id,
      COALESCE(NULLIF(trim(NEW.patient_name), ''), COALESCE(NEW.patient_email, 'Patient')),
      NULLIF(trim(COALESCE(NEW.patient_email, '')), ''),
      NULLIF(trim(COALESCE(NEW.patient_phone, '')), ''),
      NEW.patient_dob,
      COALESCE(NEW.patient_address::text, NULL)
    )
    RETURNING id INTO v_client_id;
  END IF;

  INSERT INTO public.appointment_medical_forms (
    appointment_id,
    template_id,
    profile_id,
    client_id,
    recipient_email,
    recipient_phone
  )
  SELECT
    NEW.id,
    tmf.template_id,
    NEW.profile_id,
    v_client_id,
    NULLIF(trim(COALESCE(NEW.patient_email, '')), ''),
    NULLIF(trim(COALESCE(NEW.patient_phone, '')), '')
  FROM public.treatment_medical_forms tmf
  WHERE tmf.treatment_id = NEW.treatment_id
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_medical_form_by_token(p_token text)
 RETURNS TABLE(
   form_id uuid,
   status text,
   template_name text,
   template_schema jsonb,
   patient_name text,
   scheduled_date date,
   start_time time without time zone,
   treatment_name text,
   clinic_name text,
   brand_color text,
   response jsonb,
   slug text
 )
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT
    amf.id,
    amf.status,
    mft.name,
    mft.schema,
    COALESCE(a.patient_name, cc.full_name, amf.recipient_email)::text,
    a.scheduled_date,
    a.start_time,
    COALESCE(t.name, 'Medical Form')::text,
    p.clinic_name,
    p.brand_color,
    amf.response,
    p.slug
  FROM public.appointment_medical_forms amf
  JOIN public.medical_form_templates mft ON mft.id = amf.template_id
  LEFT JOIN public.appointments a ON a.id = amf.appointment_id
  LEFT JOIN public.treatments t ON t.id = a.treatment_id
  LEFT JOIN public.clinic_clients cc ON cc.id = amf.client_id
  JOIN public.profiles p ON p.id = amf.profile_id
  WHERE amf.token = p_token
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.get_medical_form_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_medical_form_by_token(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.submit_medical_form(p_token text, p_response jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_form record;
  v_client_id uuid;
  v_email text;
  v_phone text;
  v_name text;
  v_dob date;
  v_address text;
  v_gp_name text;
  v_gp_address text;
  v_emergency_name text;
  v_emergency_phone text;
  v_allergies text;
  v_has_allergies boolean := false;
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

  v_email := lower(NULLIF(trim(COALESCE(
    p_response->>'email',
    p_response->>'email_address',
    v_form.recipient_email,
    v_form.patient_email,
    ''
  )), ''));
  v_phone := NULLIF(trim(COALESCE(p_response->>'phone', p_response->>'contact_number', p_response->>'mobile', v_form.recipient_phone, v_form.patient_phone, '')), '');
  v_name := NULLIF(trim(COALESCE(p_response->>'full_name', p_response->>'name', v_form.patient_name, '')), '');
  v_address := NULLIF(trim(COALESCE(p_response->>'address', p_response->>'home_address', v_form.patient_address::text, '')), '');
  v_gp_name := NULLIF(trim(COALESCE(p_response->>'gp_name', p_response->>'doctor_name', '')), '');
  v_gp_address := NULLIF(trim(COALESCE(p_response->>'gp_address', p_response->>'gp_practice', p_response->>'gp_surgery', '')), '');
  v_emergency_name := NULLIF(trim(COALESCE(p_response->>'emergency_contact_name', p_response->>'next_of_kin_name', p_response->>'nok_name', '')), '');
  v_emergency_phone := NULLIF(trim(COALESCE(p_response->>'emergency_contact_phone', p_response->>'next_of_kin_phone', p_response->>'nok_phone', '')), '');
  v_allergies := NULLIF(trim(COALESCE(p_response->>'allergies', p_response->>'allergy_details', p_response->>'known_allergies', '')), '');

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
    WHERE profile_id = v_form.profile_id
      AND lower(email) = v_email
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  IF v_client_id IS NULL THEN
    INSERT INTO public.clinic_clients (
      profile_id,
      full_name,
      email,
      phone,
      dob,
      address,
      gp_name,
      gp_address,
      emergency_contact_name,
      emergency_contact_phone,
      allergies,
      has_allergies,
      medical_form_data,
      medical_form_updated_at
    ) VALUES (
      v_form.profile_id,
      COALESCE(v_name, v_email, 'Patient'),
      v_email,
      v_phone,
      v_dob,
      v_address,
      v_gp_name,
      v_gp_address,
      v_emergency_name,
      v_emergency_phone,
      v_allergies,
      v_allergies IS NOT NULL,
      p_response,
      now()
    )
    RETURNING id INTO v_client_id;
  ELSE
    UPDATE public.clinic_clients
    SET full_name = COALESCE(NULLIF(full_name, ''), v_name, full_name),
        email = COALESCE(NULLIF(email, ''), v_email, email),
        phone = COALESCE(v_phone, phone),
        dob = COALESCE(dob, v_dob),
        address = COALESCE(v_address, address),
        gp_name = COALESCE(v_gp_name, gp_name),
        gp_address = COALESCE(v_gp_address, gp_address),
        emergency_contact_name = COALESCE(v_emergency_name, emergency_contact_name),
        emergency_contact_phone = COALESCE(v_emergency_phone, emergency_contact_phone),
        allergies = COALESCE(v_allergies, allergies),
        has_allergies = has_allergies OR (v_allergies IS NOT NULL),
        medical_form_data = p_response,
        medical_form_updated_at = now(),
        updated_at = now()
    WHERE id = v_client_id
      AND profile_id = v_form.profile_id;
  END IF;

  UPDATE public.appointment_medical_forms
  SET response = p_response,
      status = 'submitted',
      submitted_at = now(),
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
    WHERE appointment_id = v_form.appointment_id
      AND profile_id = v_form.profile_id;
  END IF;

  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_medical_form(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_medical_form(text, jsonb) TO anon, authenticated;
-- Only create patient records for real (non-pending, non-cancelled) bookings
CREATE OR REPLACE FUNCTION public.sync_appointment_to_client()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id uuid;
  v_addr jsonb := NEW.patient_address;
BEGIN
  IF NEW.patient_email IS NULL OR NEW.patient_email = '' THEN RETURN NEW; END IF;
  -- Unpaid holds / abandoned checkouts must not create patient records
  IF NEW.status::text IN ('pending','cancelled','expired') THEN RETURN NEW; END IF;

  SELECT id INTO v_id FROM public.clinic_clients
    WHERE profile_id = NEW.profile_id AND lower(email) = lower(NEW.patient_email)
    LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.clinic_clients (
      profile_id, full_name, email, phone, dob,
      address_line1, address_line2, city, postcode, country
    ) VALUES (
      NEW.profile_id, NEW.patient_name, NEW.patient_email, NEW.patient_phone, NEW.patient_dob,
      v_addr->>'line1', v_addr->>'line2', v_addr->>'city', v_addr->>'postcode', v_addr->>'country'
    );
  ELSE
    UPDATE public.clinic_clients SET
      full_name = COALESCE(NULLIF(full_name,''), NEW.patient_name),
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

-- Medical forms: skip while the booking is only a payment hold
CREATE OR REPLACE FUNCTION public.create_appointment_medical_forms()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_has_own boolean;
BEGIN
  IF NEW.status::text IN ('pending','cancelled','expired') THEN RETURN NEW; END IF;

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
      profile_id, full_name, email, phone, dob, address
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

  SELECT EXISTS (
    SELECT 1
    FROM public.treatment_medical_forms tmf
    JOIN public.medical_form_templates mft ON mft.id = tmf.template_id
    WHERE tmf.treatment_id = NEW.treatment_id
      AND COALESCE(mft.is_system, false) = false
  ) INTO v_has_own;

  INSERT INTO public.appointment_medical_forms (
    appointment_id, template_id, profile_id, client_id, recipient_email, recipient_phone
  )
  SELECT DISTINCT ON (tmf.template_id)
    NEW.id, tmf.template_id, NEW.profile_id, v_client_id,
    NULLIF(trim(COALESCE(NEW.patient_email, '')), ''),
    NULLIF(trim(COALESCE(NEW.patient_phone, '')), '')
  FROM public.treatment_medical_forms tmf
  JOIN public.medical_form_templates mft ON mft.id = tmf.template_id
  WHERE tmf.treatment_id = NEW.treatment_id
    AND (NOT v_has_own OR COALESCE(mft.is_system, false) = false)
    AND NOT EXISTS (
      SELECT 1 FROM public.appointment_medical_forms already
      WHERE already.appointment_id = NEW.id AND already.template_id = tmf.template_id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.appointment_medical_forms existing
      WHERE existing.profile_id = NEW.profile_id
        AND existing.template_id = tmf.template_id
        AND (
          (v_client_id IS NOT NULL AND existing.client_id = v_client_id)
          OR (
            v_client_id IS NULL
            AND NEW.patient_email IS NOT NULL
            AND lower(COALESCE(existing.recipient_email, '')) = lower(NEW.patient_email)
          )
        )
        AND (
          existing.submitted_at IS NULL
          OR existing.submitted_at > now() - interval '24 hours'
        )
    )
  ORDER BY tmf.template_id
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

-- Re-run the form creation once a hold becomes a real booking
DROP TRIGGER IF EXISTS appointments_create_medical_forms_upd ON public.appointments;
CREATE TRIGGER appointments_create_medical_forms_upd
AFTER UPDATE OF status ON public.appointments
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status AND NEW.status::text NOT IN ('pending','cancelled','expired'))
EXECUTE FUNCTION public.create_appointment_medical_forms();
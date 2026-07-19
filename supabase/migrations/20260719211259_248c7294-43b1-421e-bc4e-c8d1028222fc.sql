
CREATE OR REPLACE FUNCTION public.create_appointment_medical_forms()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_client_id uuid;
  v_has_own boolean;
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

  -- Does this treatment have any practitioner-owned (non-system) form linked?
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
  SELECT
    NEW.id, tmf.template_id, NEW.profile_id, v_client_id,
    NULLIF(trim(COALESCE(NEW.patient_email, '')), ''),
    NULLIF(trim(COALESCE(NEW.patient_phone, '')), '')
  FROM public.treatment_medical_forms tmf
  JOIN public.medical_form_templates mft ON mft.id = tmf.template_id
  WHERE tmf.treatment_id = NEW.treatment_id
    AND (NOT v_has_own OR COALESCE(mft.is_system, false) = false)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$function$;

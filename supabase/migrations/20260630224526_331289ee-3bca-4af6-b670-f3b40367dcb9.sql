
-- Extend the medical form -> client sync trigger to also pull common
-- structured fields (allergies, GP, emergency contact, DOB) onto the
-- client record so the practitioner sees them on the patient profile.
CREATE OR REPLACE FUNCTION public.sync_medical_form_to_client()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_email text;
  v_name text;
  v_client_id uuid;
  v_resp jsonb;
  v_allergies text;
  v_gp_name text;
  v_gp_address text;
  v_emerg_name text;
  v_emerg_phone text;
  v_dob date;
  v_has_allergies boolean;
BEGIN
  IF NEW.status <> 'submitted' OR NEW.response IS NULL THEN
    RETURN NEW;
  END IF;

  v_resp := NEW.response;

  -- Pull common fields by id; tolerate alternate key spellings
  v_allergies   := NULLIF(trim(COALESCE(v_resp->>'allergies', v_resp->>'known_allergies', v_resp->>'allergy_details', '')), '');
  v_gp_name     := NULLIF(trim(COALESCE(v_resp->>'gp_name', v_resp->>'gp', v_resp->>'doctor_name', '')), '');
  v_gp_address  := NULLIF(trim(COALESCE(v_resp->>'gp_address', v_resp->>'gp_surgery', v_resp->>'gp_practice', '')), '');
  v_emerg_name  := NULLIF(trim(COALESCE(v_resp->>'emergency_contact_name', v_resp->>'emergency_name', v_resp->>'next_of_kin_name', '')), '');
  v_emerg_phone := NULLIF(trim(COALESCE(v_resp->>'emergency_contact_phone', v_resp->>'emergency_phone', v_resp->>'next_of_kin_phone', '')), '');
  BEGIN
    v_dob := NULLIF(COALESCE(v_resp->>'dob', v_resp->>'date_of_birth', ''), '')::date;
  EXCEPTION WHEN others THEN v_dob := NULL; END;

  v_has_allergies := v_allergies IS NOT NULL
                     AND lower(v_allergies) NOT IN ('no','none','n/a','na','nil','no known allergies','nka');

  -- Locate client: prefer explicit id, else email, else name
  IF NEW.client_id IS NOT NULL THEN
    v_client_id := NEW.client_id;
  ELSIF NEW.appointment_id IS NOT NULL THEN
    SELECT patient_email, patient_name INTO v_email, v_name
      FROM public.appointments WHERE id = NEW.appointment_id;
    IF v_email IS NOT NULL THEN
      SELECT id INTO v_client_id FROM public.clinic_clients
        WHERE profile_id = NEW.profile_id AND lower(email) = lower(v_email) LIMIT 1;
    END IF;
    IF v_client_id IS NULL AND v_name IS NOT NULL THEN
      SELECT id INTO v_client_id FROM public.clinic_clients
        WHERE profile_id = NEW.profile_id AND lower(full_name) = lower(v_name) LIMIT 1;
    END IF;
  END IF;

  IF v_client_id IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.clinic_clients
     SET medical_form_data = v_resp,
         medical_form_updated_at = now(),
         -- only fill blanks; never overwrite practitioner-edited fields
         allergies = COALESCE(NULLIF(allergies,''), v_allergies),
         has_allergies = CASE WHEN COALESCE(has_allergies,false) THEN true ELSE COALESCE(v_has_allergies,false) END,
         gp_name = COALESCE(NULLIF(gp_name,''), v_gp_name),
         gp_address = COALESCE(NULLIF(gp_address,''), v_gp_address),
         emergency_contact_name = COALESCE(NULLIF(emergency_contact_name,''), v_emerg_name),
         emergency_contact_phone = COALESCE(NULLIF(emergency_contact_phone,''), v_emerg_phone),
         dob = COALESCE(dob, v_dob)
   WHERE id = v_client_id AND profile_id = NEW.profile_id;

  RETURN NEW;
END;
$function$;

-- Ensure trigger is bound (no-op if already present)
DROP TRIGGER IF EXISTS trg_sync_medical_form_to_client ON public.appointment_medical_forms;
CREATE TRIGGER trg_sync_medical_form_to_client
  AFTER INSERT OR UPDATE ON public.appointment_medical_forms
  FOR EACH ROW EXECUTE FUNCTION public.sync_medical_form_to_client();

DROP TRIGGER IF EXISTS trg_detect_allergies_from_medical_form ON public.appointment_medical_forms;
CREATE TRIGGER trg_detect_allergies_from_medical_form
  AFTER INSERT OR UPDATE ON public.appointment_medical_forms
  FOR EACH ROW EXECUTE FUNCTION public.detect_allergies_from_medical_form();

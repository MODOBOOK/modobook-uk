-- Always refresh the patient's clinic profile with the latest submitted
-- medical form values for demographic, address, GP, and emergency-contact
-- fields. Previously these used COALESCE(NULLIF(existing,''), new) which
-- kept stale data whenever the field had been filled once before.

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
  v_allergies_flag text;
  v_gp_name text;
  v_gp_address text;
  v_emerg_name text;
  v_emerg_phone text;
  v_dob date;
  v_has_allergies boolean;
  v_has_allergies_provided boolean;
  v_addr_line1 text;
  v_addr_line2 text;
  v_city text;
  v_postcode text;
  v_country text;
  v_phone text;
BEGIN
  IF NEW.status <> 'submitted' OR NEW.response IS NULL THEN
    RETURN NEW;
  END IF;

  v_resp := NEW.response;

  v_allergies := NULLIF(trim(COALESCE(v_resp->>'allergies_details', v_resp->>'allergy_details', v_resp->>'known_allergies', v_resp->>'allergies', '')), '');
  IF v_allergies IS NOT NULL AND lower(v_allergies) IN ('yes','no','y','n','true','false') THEN
    v_allergies := NULLIF(trim(COALESCE(v_resp->>'allergies_details', v_resp->>'allergy_details', v_resp->>'known_allergies', '')), '');
  END IF;

  v_allergies_flag := lower(COALESCE(
    v_resp->>'has_allergies',
    v_resp->>'allergies',
    v_resp->>'any_allergies',
    ''
  ));

  v_has_allergies_provided := (v_allergies_flag <> '') OR (v_allergies IS NOT NULL);
  v_has_allergies := (v_allergies_flag IN ('yes','y','true'))
                     OR (v_allergies IS NOT NULL
                         AND lower(v_allergies) NOT IN ('no','none','n/a','na','nil','no known allergies','nka'));

  v_gp_name     := NULLIF(trim(COALESCE(v_resp->>'gp_name', v_resp->>'gp', v_resp->>'doctor_name', '')), '');
  v_gp_address  := NULLIF(trim(COALESCE(v_resp->>'gp_address', v_resp->>'gp_surgery', v_resp->>'gp_practice', '')), '');
  v_emerg_name  := NULLIF(trim(COALESCE(v_resp->>'emergency_contact_name', v_resp->>'emergency_name', v_resp->>'next_of_kin_name', v_resp->>'nok_name', '')), '');
  v_emerg_phone := NULLIF(trim(COALESCE(v_resp->>'emergency_contact_phone', v_resp->>'emergency_phone', v_resp->>'next_of_kin_phone', v_resp->>'nok_phone', '')), '');
  v_addr_line1  := NULLIF(trim(COALESCE(v_resp->>'address_line1', v_resp->>'address1', v_resp->>'street_address', v_resp->>'address', '')), '');
  v_addr_line2  := NULLIF(trim(COALESCE(v_resp->>'address_line2', v_resp->>'address2', '')), '');
  v_city        := NULLIF(trim(COALESCE(v_resp->>'city', v_resp->>'town', '')), '');
  v_postcode    := NULLIF(trim(COALESCE(v_resp->>'postcode', v_resp->>'postal_code', v_resp->>'zip', '')), '');
  v_country     := NULLIF(trim(COALESCE(v_resp->>'country', '')), '');
  v_phone       := NULLIF(trim(COALESCE(v_resp->>'phone', v_resp->>'mobile', v_resp->>'contact_number', v_resp->>'telephone', '')), '');
  BEGIN
    v_dob := NULLIF(COALESCE(v_resp->>'dob', v_resp->>'date_of_birth', ''), '')::date;
  EXCEPTION WHEN others THEN v_dob := NULL; END;

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
         -- Latest form wins for every field the patient provided a value for.
         allergies               = COALESCE(v_allergies,   allergies),
         has_allergies           = CASE WHEN v_has_allergies_provided THEN v_has_allergies
                                        ELSE COALESCE(has_allergies, false) END,
         gp_name                 = COALESCE(v_gp_name,     gp_name),
         gp_address              = COALESCE(v_gp_address,  gp_address),
         emergency_contact_name  = COALESCE(v_emerg_name,  emergency_contact_name),
         emergency_contact_phone = COALESCE(v_emerg_phone, emergency_contact_phone),
         address_line1           = COALESCE(v_addr_line1,  address_line1),
         address_line2           = COALESCE(v_addr_line2,  address_line2),
         city                    = COALESCE(v_city,        city),
         postcode                = COALESCE(v_postcode,    postcode),
         country                 = COALESCE(v_country,     country),
         phone                   = COALESCE(v_phone,       phone),
         dob                     = COALESCE(v_dob,         dob),
         updated_at              = now()
   WHERE id = v_client_id AND profile_id = NEW.profile_id;

  RETURN NEW;
END; $function$;
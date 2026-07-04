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
  v_schema jsonb;
  v_step jsonb;
  v_el jsonb;
  v_label text;
  v_eid text;
  v_val text;
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

  -- 1) Canonical keys (system forms / snake_case)
  v_allergies := NULLIF(trim(COALESCE(v_resp->>'allergies_details', v_resp->>'allergy_details', v_resp->>'known_allergies', v_resp->>'allergies', '')), '');
  IF v_allergies IS NOT NULL AND lower(v_allergies) IN ('yes','no','y','n','true','false') THEN
    v_allergies := NULLIF(trim(COALESCE(v_resp->>'allergies_details', v_resp->>'allergy_details', v_resp->>'known_allergies', '')), '');
  END IF;
  v_allergies_flag := lower(COALESCE(v_resp->>'has_allergies', v_resp->>'allergies', v_resp->>'any_allergies', ''));

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

  -- 2) Label-based fallback: practitioner-built forms key responses by element id.
  --    Walk the template schema and map field labels to the profile fields.
  IF NEW.template_id IS NOT NULL THEN
    SELECT schema INTO v_schema FROM public.medical_form_templates WHERE id = NEW.template_id;

    IF v_schema IS NOT NULL AND jsonb_typeof(v_schema->'steps') = 'array' THEN
      FOR v_step IN SELECT * FROM jsonb_array_elements(v_schema->'steps') LOOP
        IF jsonb_typeof(v_step->'elements') <> 'array' THEN CONTINUE; END IF;
        FOR v_el IN SELECT * FROM jsonb_array_elements(v_step->'elements') LOOP
          v_eid := v_el->>'id';
          v_label := lower(coalesce(v_el->>'label', v_el->>'text', ''));
          IF v_eid IS NULL OR v_label = '' THEN CONTINUE; END IF;
          v_val := NULLIF(trim(coalesce(v_resp->>v_eid, '')), '');
          IF v_val IS NULL THEN CONTINUE; END IF;

          -- Allergies detail
          IF v_allergies IS NULL AND (
               v_label LIKE '%allerg%' AND (v_label LIKE '%detail%' OR v_label LIKE '%list%' OR v_label LIKE '%which%' OR v_label LIKE '%specify%' OR v_label LIKE '%known%' OR v_label ~ 'what.*allerg')
             ) AND lower(v_val) NOT IN ('yes','no','y','n','true','false') THEN
            v_allergies := v_val;
          END IF;

          -- Allergies yes/no flag
          IF v_allergies_flag = '' AND (v_label ~ '(do you have|any).*allerg' OR v_label = 'allergies' OR v_label LIKE 'has allerg%') THEN
            v_allergies_flag := lower(v_val);
          END IF;

          -- GP name / practice
          IF v_gp_name IS NULL AND (v_label ~ '(gp|doctor|general practitioner).*(name)?' AND v_label NOT LIKE '%address%' AND v_label NOT LIKE '%surgery%' AND v_label NOT LIKE '%practice%') THEN
            v_gp_name := v_val;
          END IF;
          IF v_gp_address IS NULL AND (v_label LIKE '%gp%address%' OR v_label LIKE '%gp%surgery%' OR v_label LIKE '%gp%practice%' OR v_label LIKE '%doctor%address%' OR v_label LIKE '%surgery%address%') THEN
            v_gp_address := v_val;
          END IF;

          -- Emergency contact / next of kin
          IF v_emerg_name IS NULL AND (
              (v_label LIKE '%emergency%contact%' AND v_label LIKE '%name%')
              OR (v_label LIKE '%next of kin%' AND (v_label LIKE '%name%' OR v_label = 'next of kin'))
              OR v_label = 'emergency contact'
          ) THEN
            v_emerg_name := v_val;
          END IF;
          IF v_emerg_phone IS NULL AND (
              (v_label LIKE '%emergency%' AND (v_label LIKE '%phone%' OR v_label LIKE '%number%' OR v_label LIKE '%tel%' OR v_label LIKE '%mobile%'))
              OR (v_label LIKE '%next of kin%' AND (v_label LIKE '%phone%' OR v_label LIKE '%number%' OR v_label LIKE '%tel%' OR v_label LIKE '%mobile%'))
          ) THEN
            v_emerg_phone := v_val;
          END IF;

          -- Address
          IF v_addr_line1 IS NULL AND (
              v_label LIKE '%address%line%1%' OR v_label = 'address' OR v_label LIKE '%street address%' OR v_label LIKE '%home address%'
          ) THEN
            v_addr_line1 := v_val;
          END IF;
          IF v_addr_line2 IS NULL AND (v_label LIKE '%address%line%2%' OR v_label = 'address 2') THEN
            v_addr_line2 := v_val;
          END IF;
          IF v_city IS NULL AND (v_label = 'city' OR v_label = 'town' OR v_label LIKE '%town/city%' OR v_label LIKE '%city/town%') THEN
            v_city := v_val;
          END IF;
          IF v_postcode IS NULL AND (v_label LIKE '%postcode%' OR v_label LIKE '%postal code%' OR v_label = 'zip' OR v_label LIKE '%zip code%') THEN
            v_postcode := v_val;
          END IF;
          IF v_country IS NULL AND v_label = 'country' THEN
            v_country := v_val;
          END IF;

          -- Phone
          IF v_phone IS NULL AND (
              v_label = 'phone' OR v_label = 'mobile' OR v_label = 'telephone' OR v_label LIKE '%phone number%' OR v_label LIKE '%mobile number%' OR v_label LIKE '%contact number%'
          ) AND v_label NOT LIKE '%emergency%' AND v_label NOT LIKE '%next of kin%' AND v_label NOT LIKE '%gp%' THEN
            v_phone := v_val;
          END IF;

          -- DOB
          IF v_dob IS NULL AND (v_label = 'dob' OR v_label LIKE '%date of birth%' OR v_label = 'birth date' OR v_label = 'birthday') THEN
            BEGIN v_dob := v_val::date; EXCEPTION WHEN others THEN NULL; END;
          END IF;
        END LOOP;
      END LOOP;
    END IF;
  END IF;

  v_has_allergies_provided := (v_allergies_flag <> '') OR (v_allergies IS NOT NULL);
  v_has_allergies := (v_allergies_flag IN ('yes','y','true'))
                     OR (v_allergies IS NOT NULL
                         AND lower(v_allergies) NOT IN ('no','none','n/a','na','nil','no known allergies','nka'));

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
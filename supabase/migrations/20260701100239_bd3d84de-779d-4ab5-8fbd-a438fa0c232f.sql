
CREATE OR REPLACE FUNCTION public.attach_signed_prescription_to_patient()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_client uuid; v_email text;
BEGIN
  IF NEW.status <> 'signed' OR (OLD.status = 'signed') THEN RETURN NEW; END IF;

  -- Prefer the referral's linked client (covers walk-ins with no appointment)
  IF NEW.referral_id IS NOT NULL THEN
    SELECT client_id INTO v_client
      FROM public.prescriber_referrals WHERE id = NEW.referral_id;
  END IF;

  -- Fallback: lookup via appointment email
  IF v_client IS NULL AND NEW.appointment_id IS NOT NULL THEN
    SELECT patient_email INTO v_email FROM public.appointments WHERE id = NEW.appointment_id;
    IF v_email IS NOT NULL THEN
      SELECT id INTO v_client FROM public.clinic_clients
       WHERE profile_id = NEW.practitioner_profile_id AND lower(email) = lower(v_email) LIMIT 1;
    END IF;
  END IF;

  -- Final fallback: match by patient name+email on the prescription itself
  IF v_client IS NULL AND NEW.patient_name IS NOT NULL THEN
    SELECT id INTO v_client FROM public.clinic_clients
     WHERE profile_id = NEW.practitioner_profile_id
       AND lower(full_name) = lower(NEW.patient_name)
     LIMIT 1;
  END IF;

  IF v_client IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.client_prescriptions
    (profile_id, client_id, product, dose, directions, prescribed_on, notes)
  VALUES
    (NEW.practitioner_profile_id, v_client,
     trim(coalesce(NEW.drug_name,'') || ' ' || coalesce(NEW.drug_strength,'') || ' ' || coalesce(NEW.drug_form,'')),
     NEW.dose, NEW.directions, (NEW.signed_at)::date,
     'Prescriber: ' || coalesce(NEW.prescriber_name,'') ||
       CASE WHEN NEW.pdf_url IS NOT NULL THEN E'\nPDF: ' || NEW.pdf_url ELSE '' END);
  RETURN NEW;
END; $function$;

-- Mark the referral as awaiting practitioner close once a prescription is signed,
-- so the practitioner sees a notification in their Prescriber Hub.
CREATE OR REPLACE FUNCTION public.flag_referral_awaiting_close_on_sign()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status = 'signed' AND (OLD.status IS DISTINCT FROM 'signed') AND NEW.referral_id IS NOT NULL THEN
    UPDATE public.prescriber_referrals
       SET awaiting_practitioner_close = true, updated_at = now()
     WHERE id = NEW.referral_id;
  END IF;
  RETURN NEW;
END;$$;

DROP TRIGGER IF EXISTS trg_flag_referral_awaiting_close_on_sign ON public.prescriptions;
CREATE TRIGGER trg_flag_referral_awaiting_close_on_sign
  AFTER UPDATE ON public.prescriptions
  FOR EACH ROW EXECUTE FUNCTION public.flag_referral_awaiting_close_on_sign();

-- Extend the medical form sync to also copy the patient's address into their profile
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
  v_addr_line1 text;
  v_addr_line2 text;
  v_city text;
  v_postcode text;
  v_country text;
BEGIN
  IF NEW.status <> 'submitted' OR NEW.response IS NULL THEN
    RETURN NEW;
  END IF;

  v_resp := NEW.response;

  v_allergies   := NULLIF(trim(COALESCE(v_resp->>'allergies', v_resp->>'known_allergies', v_resp->>'allergy_details', '')), '');
  v_gp_name     := NULLIF(trim(COALESCE(v_resp->>'gp_name', v_resp->>'gp', v_resp->>'doctor_name', '')), '');
  v_gp_address  := NULLIF(trim(COALESCE(v_resp->>'gp_address', v_resp->>'gp_surgery', v_resp->>'gp_practice', '')), '');
  v_emerg_name  := NULLIF(trim(COALESCE(v_resp->>'emergency_contact_name', v_resp->>'emergency_name', v_resp->>'next_of_kin_name', v_resp->>'nok_name', '')), '');
  v_emerg_phone := NULLIF(trim(COALESCE(v_resp->>'emergency_contact_phone', v_resp->>'emergency_phone', v_resp->>'next_of_kin_phone', v_resp->>'nok_phone', '')), '');
  v_addr_line1  := NULLIF(trim(COALESCE(v_resp->>'address_line1', v_resp->>'address1', v_resp->>'street_address', v_resp->>'address', '')), '');
  v_addr_line2  := NULLIF(trim(COALESCE(v_resp->>'address_line2', v_resp->>'address2', '')), '');
  v_city        := NULLIF(trim(COALESCE(v_resp->>'city', v_resp->>'town', '')), '');
  v_postcode    := NULLIF(trim(COALESCE(v_resp->>'postcode', v_resp->>'postal_code', v_resp->>'zip', '')), '');
  v_country     := NULLIF(trim(COALESCE(v_resp->>'country', '')), '');
  BEGIN
    v_dob := NULLIF(COALESCE(v_resp->>'dob', v_resp->>'date_of_birth', ''), '')::date;
  EXCEPTION WHEN others THEN v_dob := NULL; END;

  v_has_allergies := v_allergies IS NOT NULL
                     AND lower(v_allergies) NOT IN ('no','none','n/a','na','nil','no known allergies','nka');

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
         allergies = COALESCE(NULLIF(allergies,''), v_allergies),
         has_allergies = CASE WHEN COALESCE(has_allergies,false) THEN true ELSE COALESCE(v_has_allergies,false) END,
         gp_name = COALESCE(NULLIF(gp_name,''), v_gp_name),
         gp_address = COALESCE(NULLIF(gp_address,''), v_gp_address),
         emergency_contact_name = COALESCE(NULLIF(emergency_contact_name,''), v_emerg_name),
         emergency_contact_phone = COALESCE(NULLIF(emergency_contact_phone,''), v_emerg_phone),
         address_line1 = COALESCE(NULLIF(address_line1,''), v_addr_line1),
         address_line2 = COALESCE(NULLIF(address_line2,''), v_addr_line2),
         city = COALESCE(NULLIF(city,''), v_city),
         postcode = COALESCE(NULLIF(postcode,''), v_postcode),
         country = COALESCE(NULLIF(country,''), v_country),
         dob = COALESCE(dob, v_dob)
   WHERE id = v_client_id AND profile_id = NEW.profile_id;

  RETURN NEW;
END;
$function$;

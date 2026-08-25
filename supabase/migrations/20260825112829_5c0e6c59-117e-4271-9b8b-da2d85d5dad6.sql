CREATE OR REPLACE FUNCTION public.ensure_patient_referral_code(p_patient_user_id uuid, p_clinic_profile_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_existing text;
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i int;
  j int;
BEGIN
  IF p_patient_user_id IS NULL OR p_clinic_profile_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT code INTO v_existing
  FROM public.patient_referral_codes
  WHERE patient_user_id = p_patient_user_id
    AND clinic_profile_id = p_clinic_profile_id;
  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  FOR i IN 1..10 LOOP
    v_code := '';
    FOR j IN 1..6 LOOP
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    END LOOP;

    BEGIN
      INSERT INTO public.patient_referral_codes (patient_user_id, clinic_profile_id, code)
      VALUES (p_patient_user_id, p_clinic_profile_id, v_code);
      RETURN v_code;
    EXCEPTION
      WHEN unique_violation THEN
        SELECT code INTO v_existing
        FROM public.patient_referral_codes
        WHERE patient_user_id = p_patient_user_id
          AND clinic_profile_id = p_clinic_profile_id;
        IF v_existing IS NOT NULL THEN
          RETURN v_existing;
        END IF;
        -- otherwise the code collided; try again
    END;
  END LOOP;

  RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_patient_referral_code(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.create_patient_referral_code_on_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_clinic_user_id uuid;
BEGIN
  SELECT user_id INTO v_clinic_user_id FROM public.profiles WHERE id = NEW.profile_id;
  IF v_clinic_user_id IS NOT NULL AND NEW.user_id IS NOT NULL THEN
    PERFORM public.ensure_patient_referral_code(NEW.user_id, v_clinic_user_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_patient_accounts_referral_code ON public.patient_accounts;
CREATE TRIGGER trg_patient_accounts_referral_code
AFTER INSERT ON public.patient_accounts
FOR EACH ROW EXECUTE FUNCTION public.create_patient_referral_code_on_account();

-- Backfill existing patient accounts
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT DISTINCT pa.user_id, p.user_id AS clinic_user_id
    FROM public.patient_accounts pa
    JOIN public.profiles p ON p.id = pa.profile_id
    WHERE pa.user_id IS NOT NULL AND p.user_id IS NOT NULL
  LOOP
    PERFORM public.ensure_patient_referral_code(r.user_id, r.clinic_user_id);
  END LOOP;
END $$;
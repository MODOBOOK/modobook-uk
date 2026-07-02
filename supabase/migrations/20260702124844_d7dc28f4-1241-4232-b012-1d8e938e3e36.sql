
CREATE OR REPLACE FUNCTION public.patient_update_own_client(
  p_slug text,
  p_full_name text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_dob date DEFAULT NULL,
  p_gender text DEFAULT NULL,
  p_address_line1 text DEFAULT NULL,
  p_address_line2 text DEFAULT NULL,
  p_county text DEFAULT NULL,
  p_postcode text DEFAULT NULL,
  p_preferred_contact text DEFAULT NULL,
  p_emergency_contact_name text DEFAULT NULL,
  p_emergency_contact_phone text DEFAULT NULL,
  p_gp_name text DEFAULT NULL,
  p_gp_address text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_client_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id INTO v_profile_id FROM public.profiles WHERE slug = p_slug;
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Practitioner not found';
  END IF;

  v_client_id := public.current_patient_client_id(v_profile_id);
  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'No linked patient record';
  END IF;

  UPDATE public.clinic_clients SET
    full_name = COALESCE(NULLIF(p_full_name,''), full_name),
    email = COALESCE(NULLIF(p_email,''), email),
    phone = COALESCE(NULLIF(p_phone,''), phone),
    dob = COALESCE(p_dob, dob),
    gender = COALESCE(NULLIF(p_gender,''), gender),
    address_line1 = COALESCE(p_address_line1, address_line1),
    address_line2 = COALESCE(p_address_line2, address_line2),
    county = COALESCE(p_county, county),
    postcode = COALESCE(p_postcode, postcode),
    preferred_contact = COALESCE(NULLIF(p_preferred_contact,''), preferred_contact),
    emergency_contact_name = COALESCE(p_emergency_contact_name, emergency_contact_name),
    emergency_contact_phone = COALESCE(p_emergency_contact_phone, emergency_contact_phone),
    gp_name = COALESCE(p_gp_name, gp_name),
    gp_address = COALESCE(p_gp_address, gp_address),
    updated_at = now()
  WHERE id = v_client_id;

  RETURN v_client_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.patient_update_own_client(text,text,text,text,date,text,text,text,text,text,text,text,text,text,text) TO authenticated;

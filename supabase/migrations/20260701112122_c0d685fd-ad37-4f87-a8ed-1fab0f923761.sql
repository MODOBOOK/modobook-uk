CREATE OR REPLACE FUNCTION public.send_medical_form_to_client(p_client_id uuid, p_template_id uuid, p_email text, p_phone text)
 RETURNS TABLE(id uuid, token text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_profile uuid;
  v_id uuid;
  v_token text;
BEGIN
  SELECT profile_id INTO v_profile FROM public.clinic_clients WHERE clinic_clients.id = p_client_id;
  IF v_profile IS NULL OR NOT public.is_profile_owner(v_profile) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  INSERT INTO public.appointment_medical_forms (
    appointment_id, template_id, profile_id, client_id, recipient_email, recipient_phone
  ) VALUES (
    NULL, p_template_id, v_profile, p_client_id, p_email, p_phone
  ) RETURNING appointment_medical_forms.id, appointment_medical_forms.token
  INTO v_id, v_token;

  id := v_id;
  token := v_token;
  RETURN NEXT;
END;
$function$
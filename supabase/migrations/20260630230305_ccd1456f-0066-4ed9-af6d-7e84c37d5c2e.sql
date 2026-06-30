CREATE OR REPLACE FUNCTION public.ensure_hub_code(p_kind text, p_display_name text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user UUID := auth.uid();
  v_code TEXT;
  v_prefix TEXT;
  v_alphabet TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i INT;
  attempt INT := 0;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT code INTO v_code FROM public.hub_codes WHERE user_id = v_user;
  IF v_code IS NOT NULL THEN
    UPDATE public.hub_codes
      SET display_name = COALESCE(p_display_name, display_name),
          owner_kind = p_kind::public.hub_owner_kind
      WHERE user_id = v_user;
    RETURN v_code;
  END IF;

  v_prefix := CASE WHEN p_kind = 'prescriber' THEN 'RX' ELSE 'PR' END;

  LOOP
    attempt := attempt + 1;
    v_code := v_prefix;
    FOR i IN 1..6 LOOP
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    END LOOP;
    BEGIN
      INSERT INTO public.hub_codes (user_id, code, owner_kind, display_name)
        VALUES (v_user, v_code, p_kind::public.hub_owner_kind, p_display_name);
      RETURN v_code;
    EXCEPTION WHEN unique_violation THEN
      IF attempt > 20 THEN RAISE; END IF;
    END;
  END LOOP;
END;
$function$;
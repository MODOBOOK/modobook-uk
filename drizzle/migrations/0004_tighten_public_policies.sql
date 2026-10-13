-- Platform email wording: only admins read (server code uses service role / admin).
DROP POLICY IF EXISTS "anyone can read platform email customizations" ON public.platform_email_customizations;
CREATE POLICY "admins can read platform email customizations" ON public.platform_email_customizations
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Practitioner + hair/beauty waitlists are written only by server code.
DROP POLICY IF EXISTS "Anyone can join the waitlist" ON public.practitioner_waitlist;
DROP POLICY IF EXISTS "Anyone can join the hair and beauty waitlist" ON public.hair_beauty_waitlist;

-- Patient waitlist: public inserts must be well-formed, new, and for a real clinic.
DROP POLICY IF EXISTS "Anyone can join a clinic waitlist" ON public.patient_waitlist;
CREATE POLICY "Anyone can join a clinic waitlist" ON public.patient_waitlist
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    status = 'waiting'
    AND length(btrim(full_name)) BETWEEN 2 AND 120
    AND length(email) <= 255
    AND email ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    AND (phone IS NULL OR length(phone) <= 40)
    AND (preferred_times IS NULL OR length(preferred_times) <= 1000)
    AND (urgency IS NULL OR length(urgency) <= 40)
    AND (notes IS NULL OR length(notes) <= 2000)
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_id)
  );

-- Leaflet files: bind to the caller's own clinic folder(s).
DROP POLICY IF EXISTS "Practitioners manage own leaflet files" ON storage.objects;
CREATE POLICY "Practitioners manage own leaflet files" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'treatment-leaflets'
    AND (storage.foldername(name))[1] IN (SELECT p.id::text FROM public.profiles p WHERE p.user_id = (SELECT auth.uid()))
  )
  WITH CHECK (
    bucket_id = 'treatment-leaflets'
    AND (storage.foldername(name))[1] IN (SELECT p.id::text FROM public.profiles p WHERE p.user_id = (SELECT auth.uid()))
  );

-- Admin invites are only honoured once the email address is confirmed.
CREATE OR REPLACE FUNCTION public.grant_admin_if_invited()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF NEW.email_confirmed_at IS NULL THEN
    RETURN NEW;
  END IF;
  IF EXISTS (SELECT 1 FROM public.admin_invites WHERE lower(email)=lower(NEW.email) AND accepted_at IS NULL) THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin') ON CONFLICT DO NOTHING;
    UPDATE public.admin_invites SET accepted_at = now() WHERE lower(email)=lower(NEW.email);
  END IF;
  RETURN NEW;
END;
$function$;
DROP TRIGGER IF EXISTS on_auth_user_created_admin ON auth.users;
DROP TRIGGER IF EXISTS trg_grant_admin_if_invited ON auth.users;
CREATE TRIGGER trg_grant_admin_if_invited
  AFTER INSERT OR UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.grant_admin_if_invited();

-- Helper: can the current authenticated user (a patient) view a photo at this path?
-- Path convention: {profile_id}/consultations/{consultation_id}/{filename}
CREATE OR REPLACE FUNCTION public.can_patient_view_photo(path text)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile uuid;
  v_consult uuid;
BEGIN
  BEGIN
    v_profile := split_part(path, '/', 1)::uuid;
    v_consult := split_part(path, '/', 3)::uuid;
  EXCEPTION WHEN others THEN
    RETURN false;
  END;
  IF v_profile IS NULL OR v_consult IS NULL THEN RETURN false; END IF;
  RETURN EXISTS (
    SELECT 1
    FROM public.consultations c
    JOIN public.patient_accounts pa
      ON pa.profile_id = c.profile_id
     AND pa.client_id  = c.patient_id
    WHERE c.id = v_consult
      AND c.profile_id = v_profile
      AND pa.user_id = auth.uid()
  );
END;
$$;

-- Practitioner (profile owner) full access
CREATE POLICY "patient-photos: practitioner select"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'patient-photos' AND public.is_object_owner(name));

CREATE POLICY "patient-photos: practitioner insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'patient-photos' AND public.is_object_owner(name));

CREATE POLICY "patient-photos: practitioner update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'patient-photos' AND public.is_object_owner(name))
WITH CHECK (bucket_id = 'patient-photos' AND public.is_object_owner(name));

CREATE POLICY "patient-photos: practitioner delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'patient-photos' AND public.is_object_owner(name));

-- Patient read access limited to photos on their own consultations
CREATE POLICY "patient-photos: patient select"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'patient-photos' AND public.can_patient_view_photo(name));

CREATE POLICY "Active staff can read their clinic profile"
ON public.profiles FOR SELECT TO authenticated
USING (public.is_clinic_staff(id));
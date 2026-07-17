-- Restrict the "manage own" policy to authenticated so anon SELECT on training_courses
-- doesn't try to read from public.profiles (which anon can't).
DROP POLICY IF EXISTS "Practitioners manage own training courses" ON public.training_courses;
CREATE POLICY "Practitioners manage own training courses"
ON public.training_courses
FOR ALL
TO authenticated
USING (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()))
WITH CHECK (profile_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Anyone can view active training courses" ON public.training_courses;
CREATE POLICY "Anyone can view active training courses"
ON public.training_courses
FOR SELECT
TO anon, authenticated
USING (active = true);

-- Allow admins to manage system consent templates
CREATE POLICY "Admins manage system consents - insert"
ON public.consent_templates FOR INSERT TO authenticated
WITH CHECK (is_system = true AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage system consents - update"
ON public.consent_templates FOR UPDATE TO authenticated
USING (is_system = true AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (is_system = true AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage system consents - delete"
ON public.consent_templates FOR DELETE TO authenticated
USING (is_system = true AND public.has_role(auth.uid(), 'admin'));
